"""Submission analysis pipeline.

The previous implementation concatenated every file in a submission into one
string - measured at 418,463 characters / 90,048 tokens for `netherlands` - and
sent that whole string three times, sequentially, to a reasoning model.

This version is map-reduce:

  map     summarise each source document once, concurrently. The summary is
          cached under a hash that includes the document's content, so an
          unchanged file costs nothing on a re-run (IMP-008).
  reduce  generate the overview, insights and tabs concurrently from the
          summaries plus retrieved context (IMP-001, IMP-004).

The aggregation prompt drops from ~90k tokens to a few thousand, which also
removes the context-window ceiling on submission size.

Progress is reported per completed unit of work (IMP-009) and cancellation is
checked at every checkpoint (IMP-010).
"""

from __future__ import annotations

import json
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import chunking
import config
import jobs
import llm
import prompts
import retrieval
from schemas import Dashboard, FileSummary, KeyInsights, Overview, Tabs

logger = logging.getLogger("archre.pipeline")

TEXT_SUFFIXES = {".md", ".txt", ".json", ".csv"}


class Cancelled(RuntimeError):
    pass


def _check_cancel(submission_id: str) -> None:
    if jobs.is_cancel_requested(submission_id):
        raise Cancelled("Cancelled by user")


def read_submission_files(folder: Path) -> List[Tuple[str, str]]:
    """Return [(filename, text)] for a submission directory.

    Non-UTF-8 and unreadable files are skipped with a warning rather than
    failing the whole run (open question 5 in the audit).
    """
    if not folder.is_dir():
        raise FileNotFoundError(f"Submission folder not found: {folder}")

    documents: List[Tuple[str, str]] = []
    for path in sorted(folder.iterdir()):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            logger.warning("submission.skip file=%s reason=binary_or_unknown", path.name)
            continue
        try:
            text = path.read_text(encoding="utf-8").strip()
        except (UnicodeDecodeError, OSError) as e:
            logger.warning("submission.skip file=%s reason=%s", path.name, e)
            continue
        if text:
            documents.append((path.name, text))

    if not documents:
        raise ValueError(f"No readable text files in {folder}")
    return documents


def _slice_for_summary(text: str) -> List[str]:
    """Split a document that is too large to summarise in one call."""
    approx_chars = config.SUMMARY_SLICE_TOKENS * 4
    if len(text) <= approx_chars:
        return [text]
    return [text[i : i + approx_chars] for i in range(0, len(text), approx_chars)]


def summarise_document(source: str, text: str) -> FileSummary:
    slices = _slice_for_summary(text)
    if len(slices) == 1:
        return llm.structured(
            prompts.summarise_file(source, slices[0]),
            FileSummary,
            model=config.SUMMARY_MODEL_NAME,
            label=f"summary:{source}",
        )

    parts: List[FileSummary] = []
    for i, piece in enumerate(slices):
        parts.append(
            llm.structured(
                prompts.summarise_file(f"{source} (part {i + 1}/{len(slices)})", piece),
                FileSummary,
                model=config.SUMMARY_MODEL_NAME,
                label=f"summary:{source}#{i}",
            )
        )
    return FileSummary(
        summary="\n\n".join(p.summary for p in parts),
        figures=[figure for p in parts for figure in p.figures],
    )


def render_summaries(summaries: Dict[str, FileSummary]) -> str:
    blocks = []
    for source, summary in summaries.items():
        block = f"### {source}\n{summary.summary}"
        if summary.figures:
            block += "\n\nKey figures:\n" + "\n".join(f"- {f}" for f in summary.figures)
        blocks.append(block)
    return "\n\n".join(blocks)


def build_summaries(
    submission_id: str, documents: List[Tuple[str, str]]
) -> Dict[str, FileSummary]:
    """Map step: one cached summary per document, run concurrently."""
    summaries: Dict[str, FileSummary] = {}
    total = len(documents)
    done = 0

    jobs.update(submission_id, progress=5, step=f"summarising 0/{total} documents")

    with ThreadPoolExecutor(max_workers=config.MAX_CONCURRENT_LLM_CALLS) as pool:
        futures = {
            pool.submit(summarise_document, source, text): source
            for source, text in documents
        }
        for future in as_completed(futures):
            source = futures[future]
            summaries[source] = future.result()
            done += 1
            jobs.update(
                submission_id,
                # Map phase occupies 5-55% of the bar.
                progress=5 + int(done / total * 50),
                step=f"summarising {done}/{total} documents",
            )

    # Preserve input order for a stable prompt (and therefore a stable cache key).
    return {source: summaries[source] for source, _ in documents}


def build_dashboard(
    submission_id: str, summaries_text: str, context: str
) -> Dashboard:
    """Reduce step: the three artifacts, generated concurrently."""
    tasks = {
        "overview": (prompts.overview(summaries_text, context), Overview),
        "keyInsights": (prompts.key_insights(summaries_text, context), KeyInsights),
        "tabs": (prompts.tabs(summaries_text, context), Tabs),
    }
    results: Dict[str, object] = {}
    done = 0

    with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
        futures = {
            pool.submit(llm.structured, prompt, schema, label=f"generate:{name}"): name
            for name, (prompt, schema) in tasks.items()
        }
        for future in as_completed(futures):
            name = futures[future]
            results[name] = future.result()
            done += 1
            jobs.update(
                submission_id,
                progress=65 + int(done / len(tasks) * 30),
                step=f"generated {done}/{len(tasks)} sections",
            )

    overview: Overview = results["overview"]
    return Dashboard(
        title=overview.title,
        markdown=overview.markdown,
        keyInsights=results["keyInsights"].insights,
        tabs=results["tabs"].tabs,
    )


def persist(submission_id: str, dashboard: Dashboard) -> None:
    payload = dashboard.model_dump()
    config.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    config.AI_CACHED_DIR.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2)
    (config.PROCESSED_DIR / f"{submission_id}_result.json").write_text(
        text, encoding="utf-8"
    )
    (config.AI_CACHED_DIR / f"{submission_id}_dashboard.json").write_text(
        text, encoding="utf-8"
    )


def load_summaries_text(submission_id: str) -> str:
    """Summaries for chat / feedback, rebuilt from cache when possible."""
    folder = config.SUBMISSIONS_DIR / submission_id
    documents = read_submission_files(folder)
    summaries = {
        source: summarise_document(source, text) for source, text in documents
    }
    return render_summaries(summaries)


def run(submission_id: str) -> None:
    """Entry point for the background worker."""
    folder = config.SUBMISSIONS_DIR / submission_id
    try:
        _check_cancel(submission_id)
        jobs.update(submission_id, progress=1, step="reading documents")
        documents = read_submission_files(folder)

        _check_cancel(submission_id)
        summaries = build_summaries(submission_id, documents)
        summaries_text = render_summaries(summaries)

        _check_cancel(submission_id)
        jobs.update(submission_id, progress=58, step="retrieving reference material")
        # Retrieval now runs over the summaries: short, dense and representative
        # of the whole submission rather than of its first paragraph (BUG-004).
        try:
            context = retrieval.build_context(summaries_text)
        except retrieval.IndexMissingError as e:
            logger.warning("pipeline.no_context error=%s", e)
            context = ""

        _check_cancel(submission_id)
        jobs.update(submission_id, progress=65, step="generating analysis")
        dashboard = build_dashboard(submission_id, summaries_text, context)

        _check_cancel(submission_id)
        jobs.update(submission_id, progress=97, step="saving results")
        persist(submission_id, dashboard)

        jobs.finish(submission_id, dashboard.model_dump())

    except Cancelled:
        jobs.cancel(submission_id)
    except FileNotFoundError as e:
        jobs.fail(submission_id, "read", str(e))
    except ValueError as e:
        jobs.fail(submission_id, "read", str(e))
    except llm.AIQueryError as e:
        jobs.fail(submission_id, "generate", str(e))
    except Exception as e:  # last resort - still records the real cause
        logger.exception("pipeline.unexpected submission=%s", submission_id)
        jobs.fail(submission_id, "unexpected", f"{type(e).__name__}: {e}")
