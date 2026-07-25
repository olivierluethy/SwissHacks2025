"""Chunking must never silently drop text (BUG-004)."""

import pytest

import chunking


class FakeTokenizer:
    """Whitespace tokenizer with the same interface chunking.py relies on."""

    def encode(self, text, add_special_tokens=False):
        return text.split()

    def decode(self, ids):
        return " ".join(ids)


@pytest.fixture
def tokenizer():
    return FakeTokenizer()


def test_short_text_is_one_chunk(tokenizer):
    assert chunking.chunk_tokens("hello world", tokenizer, max_tokens=10) == [
        "hello world"
    ]


def test_empty_input_produces_no_chunks(tokenizer):
    for value in ("", "   ", "\n\n\n"):
        assert chunking.chunk_tokens(value, tokenizer) == []


def test_every_chunk_respects_the_token_budget(tokenizer):
    text = "\n\n".join(f"para{i} " + " ".join(["w"] * 30) for i in range(20))
    chunks = chunking.chunk_tokens(text, tokenizer, max_tokens=50, overlap_tokens=5)
    assert chunks
    for chunk in chunks:
        assert len(tokenizer.encode(chunk)) <= 50


def test_no_content_is_lost(tokenizer):
    """The whole point: a long document must not be truncated."""
    words = [f"w{i}" for i in range(500)]
    text = " ".join(words)
    chunks = chunking.chunk_tokens(text, tokenizer, max_tokens=40, overlap_tokens=0)
    seen = " ".join(chunks).split()
    assert seen == words


def test_oversized_paragraph_is_split_not_truncated(tokenizer):
    words = [f"w{i}" for i in range(200)]
    text = " ".join(words)
    chunks = chunking.chunk_tokens(text, tokenizer, max_tokens=25, overlap_tokens=0)
    assert len(chunks) > 1
    assert " ".join(chunks).split() == words


def test_overlap_repeats_tail_of_previous_chunk(tokenizer):
    words = [f"w{i}" for i in range(100)]
    chunks = chunking.chunk_tokens(
        " ".join(words), tokenizer, max_tokens=20, overlap_tokens=5
    )
    assert len(chunks) > 1
    first_tail = chunks[0].split()[-5:]
    second_head = chunks[1].split()[:5]
    assert first_tail == second_head


def test_chunk_documents_tracks_source_and_ordinal(tokenizer):
    docs = [("a.md", " ".join(["x"] * 100)), ("b.md", "short")]
    chunks = chunking.chunk_documents(docs, tokenizer, max_tokens=20, overlap_tokens=0)
    assert {c.source for c in chunks} == {"a.md", "b.md"}
    a_ordinals = [c.ordinal for c in chunks if c.source == "a.md"]
    assert a_ordinals == list(range(len(a_ordinals)))


def test_sample_evenly_covers_the_whole_sequence():
    items = list(range(100))
    sampled = chunking.sample_evenly(items, 5)
    assert len(sampled) == 5
    assert sampled[0] == 0
    # Must reach into the tail, not just take a prefix - that was the original bug.
    assert sampled[-1] >= 75


def test_sample_evenly_passthrough_when_under_limit():
    assert chunking.sample_evenly([1, 2, 3], 10) == [1, 2, 3]
    assert chunking.sample_evenly([1, 2, 3], None) == [1, 2, 3]


def test_invalid_budget_rejected(tokenizer):
    with pytest.raises(ValueError):
        chunking.chunk_tokens("x", tokenizer, max_tokens=0)
