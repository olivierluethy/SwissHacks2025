"""Build the chunk-level retrieval index from the auxiliary corpus.

    cd backend && python -m scripts.build_index [--limit N]

Writes `data/index/chunks.npz` (L2-normalised float32 vectors) and
`data/index/chunks.jsonl` (source, ordinal, text). Both are build artifacts and
are gitignored.

IMP-012: replaces the committed 50 MB `data/embeddings.json`, which stored one
vector per whole file and was re-parsed from JSON on every call.
BUG-013/BUG-014: the previous generator crashed with NameError on the first file
with an unexpected extension and produced OS-dependent keys with backslashes.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import chunking  # noqa: E402
import config  # noqa: E402
import retrieval  # noqa: E402

ALLOWED_EXTENSIONS = (".md", ".csv", ".txt")

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)-8s %(name)s: %(message)s"
)
logger = logging.getLogger("build_index")


def iter_corpus_files(root: Path):
    for path in sorted(root.rglob("*")):
        if not path.is_file():
            continue
        # BUG-013: check the extension before using any derived variable.
        if path.suffix.lower() not in ALLOWED_EXTENSIONS:
            logger.debug("skip %s (extension)", path.name)
            continue
        # BUG-014: POSIX-style relative keys regardless of host OS.
        yield path.relative_to(root).as_posix(), path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--limit", type=int, default=None, help="Only index the first N files"
    )
    parser.add_argument(
        "--batch-size", type=int, default=256, help="Encoder batch size"
    )
    args = parser.parse_args()

    corpus = config.AUX_DATA_DIR
    if not corpus.is_dir():
        logger.error("Corpus directory not found: %s", corpus)
        return 1

    config.INDEX_DIR.mkdir(parents=True, exist_ok=True)
    tokenizer = retrieval.get_tokenizer()

    started = time.perf_counter()
    documents = []
    skipped_empty = 0
    for relative, path in iter_corpus_files(corpus):
        try:
            text = path.read_text(encoding="utf-8").strip()
        except UnicodeDecodeError:
            logger.warning("skip %s (not utf-8)", relative)
            continue
        if not text:
            skipped_empty += 1
            continue
        documents.append((relative, text))
        if args.limit and len(documents) >= args.limit:
            break

    logger.info(
        "read %d documents (%d empty skipped) in %.1fs",
        len(documents),
        skipped_empty,
        time.perf_counter() - started,
    )

    chunk_started = time.perf_counter()
    chunks = []
    dropped = 0
    for source, text in documents:
        if source.lower().endswith(".csv"):
            # One descriptive chunk per table rather than many numeric ones.
            chunks.append(
                chunking.Chunk(
                    text=chunking.describe_tabular(source, text),
                    source=source,
                    ordinal=0,
                )
            )
            continue
        for ordinal, piece in enumerate(chunking.chunk_tokens(text, tokenizer)):
            if not chunking.is_informative(piece):
                dropped += 1
                continue
            chunks.append(
                chunking.Chunk(text=piece, source=source, ordinal=ordinal)
            )

    logger.info(
        "produced %d chunks from %d documents in %.1fs (%d low-information chunks dropped)",
        len(chunks),
        len(documents),
        time.perf_counter() - chunk_started,
        dropped,
    )
    if not chunks:
        logger.error("nothing to index")
        return 1

    encode_started = time.perf_counter()
    vectors = retrieval.encode([c.text for c in chunks], batch_size=args.batch_size)
    logger.info(
        "encoded %d chunks in %.1fs (%.0f chunks/s)",
        len(chunks),
        time.perf_counter() - encode_started,
        len(chunks) / max(1e-6, time.perf_counter() - encode_started),
    )

    np.savez_compressed(retrieval.INDEX_VECTORS, vectors=vectors)
    with open(retrieval.INDEX_META, "w", encoding="utf-8") as handle:
        for chunk in chunks:
            handle.write(
                json.dumps(
                    {
                        "source": chunk.source,
                        "ordinal": chunk.ordinal,
                        "text": chunk.text,
                    }
                )
                + "\n"
            )

    size_mb = (
        retrieval.INDEX_VECTORS.stat().st_size + retrieval.INDEX_META.stat().st_size
    ) / 1e6
    logger.info(
        "wrote index: %d chunks, %.1f MB, total %.1fs",
        len(chunks),
        size_mb,
        time.perf_counter() - started,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
