"""Token-aware text chunking.

BUG-004: retrieval used to embed an entire submission - measured at 104,832
tokens - through an encoder whose `max_seq_length` is 256. Everything past the
first ~1,000 characters was silently discarded, which is why the Netherlands and
Turkey submissions both retrieved Florida hurricane claims as their "context".

Chunking is done on the encoder's own tokenizer so a chunk is guaranteed to fit.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence

import config


@dataclass(frozen=True)
class Chunk:
    text: str
    source: str
    ordinal: int


MIN_ALPHA_WORDS = 12
MIN_ALPHA_RATIO = 0.45


def is_informative(text: str) -> bool:
    """Reject chunks that carry no retrievable meaning.

    Two degenerate classes polluted the first build of the chunk index, both
    verified by inspection of its output:

    - Boilerplate tails of scraped articles ("Topics\\nWindstorm\\nEurope"),
      which matched almost any prose query at ~0.62.
    - Blocks of raw numbers from time-series CSVs, whose embeddings are nearly
      identical to each other and scored 0.99 against any tabular query.
    """
    words = [w for w in text.split() if any(ch.isalpha() for ch in w)]
    if len(words) < MIN_ALPHA_WORDS:
        return False
    alpha = sum(ch.isalpha() or ch.isspace() for ch in text)
    return (alpha / max(1, len(text))) >= MIN_ALPHA_RATIO


def describe_tabular(source: str, text: str, max_rows: int = 3) -> str:
    """Summarise a CSV as one descriptive chunk instead of many numeric ones.

    The meaning of a rates time series lives in its name and columns, not in row
    40,000; indexing every row block made every CSV a near-duplicate of every
    other one.
    """
    lines = [line for line in text.splitlines() if line.strip()]
    header = lines[0] if lines else ""
    sample = lines[1 : 1 + max_rows]
    return (
        f"Tabular data file: {source}\n"
        f"Columns: {header}\n"
        f"Rows: {max(0, len(lines) - 1)}\n"
        f"Sample rows:\n" + "\n".join(sample)
    )


def _split_paragraphs(text: str) -> List[str]:
    parts: List[str] = []
    for block in text.split("\n\n"):
        block = block.strip()
        if block:
            parts.append(block)
    return parts


def chunk_tokens(
    text: str,
    tokenizer,
    *,
    max_tokens: int = None,
    overlap_tokens: int = None,
) -> List[str]:
    """Split `text` into pieces of at most `max_tokens` tokens, with overlap.

    Paragraph boundaries are respected where possible; a paragraph longer than
    the budget is hard-split on token boundaries rather than truncated.
    """
    # `or` would swallow an explicit 0 and silently fall back to the default.
    max_tokens = config.CHUNK_TOKENS if max_tokens is None else max_tokens
    overlap_tokens = (
        config.CHUNK_OVERLAP_TOKENS if overlap_tokens is None else overlap_tokens
    )
    if max_tokens <= 0:
        raise ValueError("max_tokens must be positive")
    overlap_tokens = max(0, min(overlap_tokens, max_tokens - 1))

    text = (text or "").strip()
    if not text:
        return []

    def n_tokens(s: str) -> int:
        return len(tokenizer.encode(s, add_special_tokens=False))

    def hard_split(s: str) -> List[str]:
        ids = tokenizer.encode(s, add_special_tokens=False)
        out: List[str] = []
        step = max_tokens - overlap_tokens
        for start in range(0, len(ids), step):
            piece_ids = ids[start : start + max_tokens]
            if not piece_ids:
                break
            out.append(tokenizer.decode(piece_ids).strip())
            if start + max_tokens >= len(ids):
                break
        return [p for p in out if p]

    chunks: List[str] = []
    buffer: List[str] = []
    buffer_tokens = 0

    for paragraph in _split_paragraphs(text):
        p_tokens = n_tokens(paragraph)

        if p_tokens > max_tokens:
            if buffer:
                chunks.append("\n\n".join(buffer))
                buffer, buffer_tokens = [], 0
            chunks.extend(hard_split(paragraph))
            continue

        if buffer_tokens + p_tokens > max_tokens and buffer:
            chunks.append("\n\n".join(buffer))
            buffer, buffer_tokens = [], 0

        buffer.append(paragraph)
        buffer_tokens += p_tokens

    if buffer:
        chunks.append("\n\n".join(buffer))

    return [c for c in (c.strip() for c in chunks) if c]


def chunk_documents(
    documents: Iterable[tuple], tokenizer, **kwargs
) -> List[Chunk]:
    """`documents` is an iterable of (source_name, text)."""
    result: List[Chunk] = []
    for source, text in documents:
        for ordinal, piece in enumerate(chunk_tokens(text, tokenizer, **kwargs)):
            result.append(Chunk(text=piece, source=source, ordinal=ordinal))
    return result


def sample_evenly(items: Sequence, limit: Optional[int]) -> List:
    """Take at most `limit` items, spread across the whole sequence.

    Used to bound how many query chunks a very large submission contributes to
    retrieval without only ever looking at its first pages.
    """
    if limit is None or limit <= 0 or len(items) <= limit:
        return list(items)
    step = len(items) / limit
    return [items[int(i * step)] for i in range(limit)]
