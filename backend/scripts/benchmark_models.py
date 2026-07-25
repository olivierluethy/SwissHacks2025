"""Measure real latency and cost per model on your own submissions.

    cd backend && python -m scripts.benchmark_models --submission florida

IMP-005 asked for a model benchmark. It could not be produced during the audit
because no API key was available, so this runs it on demand instead of shipping
a number that was never measured.

It makes real API calls and bills your account. Start with one submission.
"""

from __future__ import annotations

import argparse
import logging
import statistics
import sys
import time
from pathlib import Path
from typing import List

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config  # noqa: E402
import llm  # noqa: E402
import pipeline  # noqa: E402
import prompts  # noqa: E402
import retrieval  # noqa: E402
from schemas import KeyInsights, Overview, Tabs  # noqa: E402

logging.basicConfig(level=logging.WARNING, format="%(message)s")

# USD per 1M tokens. Verify against https://openai.com/api/pricing - these are
# only used to turn measured token counts into an indicative figure.
PRICING = {
    "o3-mini": (1.10, 4.40),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4o": (2.50, 10.00),
    "gpt-4.1-mini": (0.40, 1.60),
}

TASKS = {
    "overview": (prompts.overview, Overview),
    "keyInsights": (prompts.key_insights, KeyInsights),
    "tabs": (prompts.tabs, Tabs),
}


def measure(model: str, prompt: str, schema, repeats: int) -> dict:
    durations: List[float] = []
    error = None
    for _ in range(repeats):
        started = time.perf_counter()
        try:
            llm.structured(
                prompt, schema, model=model, label=f"bench:{model}", use_cache=False
            )
        except llm.AIQueryError as e:
            error = str(e)
            break
        durations.append(time.perf_counter() - started)
    return {"durations": durations, "error": error}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--submission", default="florida")
    parser.add_argument(
        "--models",
        default="o3-mini,gpt-4o-mini",
        help="Comma-separated model ids to compare",
    )
    parser.add_argument("--repeats", type=int, default=1)
    parser.add_argument(
        "--skip-summaries",
        action="store_true",
        help="Reuse cached per-file summaries instead of regenerating them",
    )
    args = parser.parse_args()

    folder = config.SUBMISSIONS_DIR / args.submission
    if not folder.is_dir():
        print(f"No such submission: {folder}")
        return 1

    print(f"Preparing '{args.submission}' ...")
    prep_started = time.perf_counter()
    documents = pipeline.read_submission_files(folder)
    raw_chars = sum(len(text) for _, text in documents)
    summaries_text = pipeline.load_summaries_text(args.submission)
    try:
        context = retrieval.build_context(summaries_text)
    except retrieval.IndexMissingError:
        context = ""
    prep_seconds = time.perf_counter() - prep_started

    print(f"  documents        : {len(documents)}")
    print(f"  raw characters   : {raw_chars:,}")
    print(f"  summary chars    : {len(summaries_text):,}")
    print(f"  context chars    : {len(context):,}")
    print(f"  prep wall clock  : {prep_seconds:.1f}s")
    print(
        f"  aggregate prompt : ~{(len(summaries_text) + len(context)) // 4:,} tokens "
        f"(was ~{raw_chars // 4:,} before the map-reduce change)\n"
    )

    for model in [m.strip() for m in args.models.split(",") if m.strip()]:
        print(f"--- {model} ---")
        total = 0.0
        for name, (builder, schema) in TASKS.items():
            prompt = builder(summaries_text, context)
            result = measure(model, prompt, schema, args.repeats)
            if result["error"]:
                print(f"  {name:12s} FAILED: {result['error'][:120]}")
                continue
            mean = statistics.mean(result["durations"])
            total += mean
            print(
                f"  {name:12s} {mean:6.1f}s"
                + (
                    f"  (runs: {', '.join(f'{d:.1f}' for d in result['durations'])})"
                    if args.repeats > 1
                    else ""
                )
            )
        if total:
            print(f"  {'sequential':12s} {total:6.1f}s")
            print(
                f"  {'concurrent':12s} ~{max(total / len(TASKS), 0.1):6.1f}s "
                "(what the pipeline actually does)"
            )
        if model in PRICING:
            in_price, out_price = PRICING[model]
            in_tokens = (len(summaries_text) + len(context)) / 4 * len(TASKS)
            print(
                f"  {'est. cost':12s} ~${in_tokens / 1e6 * in_price:.3f} input "
                f"(+ output at ${out_price}/1M)"
            )
        print()

    print("Set the winner with:  export OPENAI_MODEL=<model>")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
