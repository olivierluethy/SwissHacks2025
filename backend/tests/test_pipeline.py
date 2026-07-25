"""Pipeline behaviour with the model stubbed out.

No OpenAI call is made; `llm.structured` is monkeypatched. These cover the parts
the audit flagged as untested: reading submissions, the map-reduce shape,
cancellation and failure handling.
"""

import json

import pytest

import config
import jobs
import llm
import pipeline
from schemas import FileSummary, KeyInsight, KeyInsights, Overview, Tab, Tabs


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "JOBS_DB", tmp_path / "jobs.sqlite3")
    monkeypatch.setattr(config, "SUBMISSIONS_DIR", tmp_path / "submissions")
    monkeypatch.setattr(config, "PROCESSED_DIR", tmp_path / "processed")
    monkeypatch.setattr(config, "AI_CACHED_DIR", tmp_path / "ai_cached")
    monkeypatch.setattr(config, "LLM_CACHE_DIR", tmp_path / "llm_cache")
    for directory in ("submissions", "processed", "ai_cached", "llm_cache"):
        (tmp_path / directory).mkdir()
    jobs.reset_for_tests()
    jobs.init()
    # Retrieval is exercised separately; keep the pipeline offline.
    monkeypatch.setattr(pipeline.retrieval, "build_context", lambda *a, **k: "CONTEXT")
    yield
    jobs.reset_for_tests()


def make_submission(name="florida", files=None):
    folder = config.SUBMISSIONS_DIR / name
    folder.mkdir(parents=True, exist_ok=True)
    files = files or {"a.md": "Premium: 100", "b.md": "Limit: 200"}
    for filename, content in files.items():
        (folder / filename).write_text(content, encoding="utf-8")
    return folder


def stub_llm(monkeypatch, calls=None):
    def fake_structured(prompt, schema, **kwargs):
        if calls is not None:
            calls.append((schema.__name__, kwargs.get("label")))
        if schema is FileSummary:
            return FileSummary(summary="summary text", figures=["Premium: 100"])
        if schema is Overview:
            return Overview(title="Title", markdown="Body")
        if schema is KeyInsights:
            return KeyInsights(
                insights=[
                    KeyInsight(
                        title="i", description="d", impact="positive", confidence=0.5
                    )
                ]
            )
        if schema is Tabs:
            return Tabs(
                tabs=[
                    Tab.model_validate(
                        {
                            "id": "t",
                            "title": "T",
                            "content": {"type": "html", "data": "<p>x</p>"},
                        }
                    )
                ]
            )
        raise AssertionError(f"unexpected schema {schema}")

    monkeypatch.setattr(llm, "structured", fake_structured)
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)


# ---------------------------------------------------------------------------
# Reading
# ---------------------------------------------------------------------------
def test_reads_only_text_files():
    folder = make_submission(files={"a.md": "x", "b.json": "{}", "c.png": "binary"})
    documents = pipeline.read_submission_files(folder)
    assert {name for name, _ in documents} == {"a.md", "b.json"}


def test_skips_non_utf8_instead_of_failing_the_run():
    """Audit open question 5: one stray binary file used to kill the whole run."""
    folder = make_submission(files={"good.md": "readable"})
    (folder / "bad.md").write_bytes(b"\xff\xfe\x00binary\x00")
    documents = pipeline.read_submission_files(folder)
    assert [name for name, _ in documents] == ["good.md"]


def test_empty_submission_raises():
    folder = config.SUBMISSIONS_DIR / "empty"
    folder.mkdir(parents=True)
    with pytest.raises(ValueError):
        pipeline.read_submission_files(folder)


def test_missing_submission_raises():
    with pytest.raises(FileNotFoundError):
        pipeline.read_submission_files(config.SUBMISSIONS_DIR / "nope")


# ---------------------------------------------------------------------------
# Map-reduce shape (IMP-004)
# ---------------------------------------------------------------------------
def test_run_produces_a_dashboard(monkeypatch):
    make_submission()
    stub_llm(monkeypatch)
    jobs.claim("florida")

    pipeline.run("florida")

    job = jobs.get("florida")
    assert job.status == jobs.COMPLETED
    assert job.progress == 100
    dashboard = json.loads(
        (config.AI_CACHED_DIR / "florida_dashboard.json").read_text(encoding="utf-8")
    )
    assert dashboard["title"] == "Title"
    assert len(dashboard["keyInsights"]) == 1
    assert len(dashboard["tabs"]) == 1


def test_one_summary_per_document_then_three_aggregates(monkeypatch):
    calls = []
    make_submission(files={"a.md": "x", "b.md": "y", "c.md": "z"})
    stub_llm(monkeypatch, calls)
    jobs.claim("florida")

    pipeline.run("florida")

    schemas_used = [name for name, _ in calls]
    assert schemas_used.count("FileSummary") == 3
    assert schemas_used.count("Overview") == 1
    assert schemas_used.count("KeyInsights") == 1
    assert schemas_used.count("Tabs") == 1


def test_aggregate_prompt_uses_summaries_not_raw_documents(monkeypatch):
    """IMP-004: the whole point is that the corpus is no longer re-sent."""
    seen = {}

    def fake_structured(prompt, schema, **kwargs):
        seen[schema.__name__] = prompt
        if schema is FileSummary:
            return FileSummary(summary="SUMMARY-MARKER", figures=[])
        if schema is Overview:
            return Overview(title="t", markdown="m")
        if schema is KeyInsights:
            return KeyInsights(insights=[])
        return Tabs(tabs=[])

    make_submission(files={"a.md": "RAW-DOCUMENT-MARKER " * 100})
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)
    jobs.claim("florida")

    pipeline.run("florida")

    assert "SUMMARY-MARKER" in seen["Overview"]
    assert "RAW-DOCUMENT-MARKER" not in seen["Overview"]


def test_progress_advances_monotonically(monkeypatch):
    observed = []
    make_submission(files={"a.md": "x", "b.md": "y"})
    stub_llm(monkeypatch)
    original_update = jobs.update

    def spy(submission_id, **kwargs):
        if kwargs.get("progress") is not None:
            observed.append(kwargs["progress"])
        original_update(submission_id, **kwargs)

    monkeypatch.setattr(pipeline.jobs, "update", spy)
    jobs.claim("florida")

    pipeline.run("florida")

    assert observed == sorted(observed)
    assert observed[0] < observed[-1] <= 100


# ---------------------------------------------------------------------------
# Failure and cancellation
# ---------------------------------------------------------------------------
def test_model_failure_is_recorded_with_the_real_cause(monkeypatch):
    make_submission()

    def boom(prompt, schema, **kwargs):
        raise llm.AIQueryError("upstream exploded")

    monkeypatch.setattr(pipeline.llm, "structured", boom)
    jobs.claim("florida")

    pipeline.run("florida")

    job = jobs.get("florida")
    assert job.status == jobs.FAILED
    assert "upstream exploded" in job.error


def test_missing_submission_is_recorded_as_failed(monkeypatch):
    stub_llm(monkeypatch)
    jobs.claim("ghost")
    pipeline.run("ghost")
    assert jobs.get("ghost").status == jobs.FAILED


def test_cancellation_stops_the_run(monkeypatch):
    """IMP-010: a run must be stoppable, not just abandonable."""
    make_submission()
    stub_llm(monkeypatch)
    jobs.claim("florida")
    jobs.request_cancel("florida")

    pipeline.run("florida")

    assert jobs.get("florida").status == jobs.CANCELLED
    assert not (config.AI_CACHED_DIR / "florida_dashboard.json").exists()


def test_large_document_is_sliced_for_summarisation(monkeypatch):
    slices = []

    def fake_structured(prompt, schema, **kwargs):
        if schema is FileSummary:
            slices.append(kwargs.get("label"))
            return FileSummary(summary="s", figures=[])
        if schema is Overview:
            return Overview(title="t", markdown="m")
        if schema is KeyInsights:
            return KeyInsights(insights=[])
        return Tabs(tabs=[])

    monkeypatch.setattr(config, "SUMMARY_SLICE_TOKENS", 100)  # ~400 chars
    make_submission(files={"big.md": "x" * 2000})
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)
    jobs.claim("florida")

    pipeline.run("florida")

    assert len(slices) > 1, "a document larger than the slice budget must be split"


# ---------------------------------------------------------------------------
# Concurrency (audit section 4.3 - the dominant bottleneck)
# ---------------------------------------------------------------------------
def test_document_slices_are_summarised_concurrently(monkeypatch):
    """A large document used to be summarised one slice at a time."""
    import threading
    import time

    in_flight = []
    peak = [0]
    lock = threading.Lock()

    def fake_structured(prompt, schema, **kwargs):
        if schema is FileSummary:
            with lock:
                in_flight.append(1)
                peak[0] = max(peak[0], len(in_flight))
            time.sleep(0.15)
            with lock:
                in_flight.pop()
            return FileSummary(summary="s", figures=[])
        if schema is Overview:
            return Overview(title="t", markdown="m")
        if schema is KeyInsights:
            return KeyInsights(insights=[])
        return Tabs(tabs=[])

    monkeypatch.setattr(config, "SUMMARY_SLICE_TOKENS", 100)  # ~400 chars/slice
    make_submission(files={"big.md": "x" * 2000})  # -> 5 slices
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)
    jobs.claim("florida")

    pipeline.run("florida")

    assert peak[0] > 1, "slices of one document must overlap, not run end to end"


def test_chat_prep_summarises_concurrently_and_then_caches(monkeypatch):
    """load_summaries_text ran N sequential calls on *every* chat message."""
    import threading
    import time

    calls = []
    peak = [0]
    in_flight = []
    lock = threading.Lock()

    def fake_structured(prompt, schema, **kwargs):
        with lock:
            calls.append(kwargs.get("label"))
            in_flight.append(1)
            peak[0] = max(peak[0], len(in_flight))
        time.sleep(0.15)
        with lock:
            in_flight.pop()
        return FileSummary(summary="s", figures=[])

    make_submission(files={f"d{i}.md": f"content {i}" for i in range(4)})
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)

    first = pipeline.load_summaries_text("florida")
    assert len(calls) == 4
    assert peak[0] > 1, "documents must be summarised concurrently"

    calls.clear()
    second = pipeline.load_summaries_text("florida")

    assert second == first
    assert calls == [], "a second call must be served from the cache"


def test_summary_cache_invalidates_when_a_document_changes(monkeypatch):
    calls = []

    def fake_structured(prompt, schema, **kwargs):
        calls.append(kwargs.get("label"))
        return FileSummary(summary="s", figures=[])

    folder = make_submission(files={"a.md": "original"})
    monkeypatch.setattr(pipeline.llm, "structured", fake_structured)

    pipeline.load_summaries_text("florida")
    assert len(calls) == 1

    calls.clear()
    (folder / "a.md").write_text("changed", encoding="utf-8")
    pipeline.load_summaries_text("florida")
    assert len(calls) == 1, "changed content must not be served from the cache"


def test_run_primes_the_chat_summary_cache(monkeypatch):
    """The first question after an analysis must not redo the map step."""
    stub_llm(monkeypatch)
    make_submission(files={"a.md": "x", "b.md": "y"})
    jobs.claim("florida")
    pipeline.run("florida")

    calls = []

    def counting(prompt, schema, **kwargs):
        calls.append(schema.__name__)
        return FileSummary(summary="s", figures=[])

    monkeypatch.setattr(pipeline.llm, "structured", counting)
    pipeline.load_summaries_text("florida")

    assert calls == [], "analysis should have already populated the summary cache"
