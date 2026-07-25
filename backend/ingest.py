"""Upload ingestion (IMP-015).

`data/file_parser.py` contains the Excel/PDF -> Markdown conversion the product
is built on, but it was only reachable as a manual CLI script - the API had no
upload path at all, so "the app extracts data" was not true of the running
system. This module wires it in.

`marker-pdf` (and therefore PyTorch) is imported lazily, so the API still starts
and serves everything else when PDF support is unavailable.
"""

from __future__ import annotations

import logging
import re
import shutil
import zipfile
from pathlib import Path
from typing import List, Tuple

import config

logger = logging.getLogger("archre.ingest")

EXCEL_SUFFIXES = {".xlsx"}
PDF_SUFFIXES = {".pdf"}
TEXT_SUFFIXES = {".md", ".txt", ".csv", ".json"}
ARCHIVE_SUFFIXES = {".zip"}
SUPPORTED = EXCEL_SUFFIXES | PDF_SUFFIXES | TEXT_SUFFIXES | ARCHIVE_SUFFIXES

MAX_UPLOAD_BYTES = 100 * 1024 * 1024

_SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]")


class UnsupportedFile(ValueError):
    pass


def safe_name(name: str) -> str:
    """Reduce an uploaded filename to a safe basename.

    Uploads are attacker-controlled; `../../etc/cron.d/x` must not survive.
    """
    base = Path(name).name
    cleaned = _SAFE_NAME_RE.sub("_", base).lstrip(".")
    return cleaned or "unnamed"


def convert_excel(data: bytes) -> str:
    from data.file_parser import create_markdown_from_workbook_bytes

    return create_markdown_from_workbook_bytes(data)


def convert_pdf(path: Path) -> str:
    # Imported here: marker-pdf pulls in PyTorch and takes seconds to load.
    from data.file_parser import process_pdf_file

    return process_pdf_file(str(path), output_format="md")


def convert_one(name: str, data: bytes, workdir: Path) -> List[Tuple[str, str]]:
    """Convert one uploaded file to [(output_name, markdown)]."""
    suffix = Path(name).suffix.lower()
    stem = Path(safe_name(name)).stem

    if suffix in TEXT_SUFFIXES:
        try:
            return [(safe_name(name), data.decode("utf-8"))]
        except UnicodeDecodeError as e:
            raise UnsupportedFile(f"{name} is not valid UTF-8 text: {e}")

    if suffix in EXCEL_SUFFIXES:
        return [(f"{stem}.xlsx.md", convert_excel(data))]

    if suffix in PDF_SUFFIXES:
        temp_path = workdir / safe_name(name)
        temp_path.write_bytes(data)
        return [(f"{stem}.pdf.md", convert_pdf(temp_path))]

    if suffix in ARCHIVE_SUFFIXES:
        results: List[Tuple[str, str]] = []
        extract_dir = workdir / f"{stem}_zip"
        extract_dir.mkdir(parents=True, exist_ok=True)
        temp_zip = workdir / safe_name(name)
        temp_zip.write_bytes(data)
        with zipfile.ZipFile(temp_zip) as archive:
            for member in archive.namelist():
                if member.endswith("/"):
                    continue
                member_name = safe_name(member)
                if Path(member_name).suffix.lower() not in SUPPORTED - ARCHIVE_SUFFIXES:
                    logger.info("ingest.skip_zip_member name=%s", member)
                    continue
                with archive.open(member) as handle:
                    try:
                        results.extend(
                            convert_one(member_name, handle.read(), extract_dir)
                        )
                    except UnsupportedFile as e:
                        logger.warning("ingest.skip name=%s error=%s", member, e)
        return results

    raise UnsupportedFile(
        f"Unsupported file type '{suffix}'. Accepted: "
        + ", ".join(sorted(SUPPORTED))
    )


def store_submission(submission_id: str, files: List[Tuple[str, bytes]]) -> List[str]:
    """Convert and persist an uploaded submission. Returns written filenames."""
    target = config.SUBMISSIONS_DIR / submission_id
    if target.exists():
        raise FileExistsError(f"Submission '{submission_id}' already exists")

    workdir = config.UPLOAD_DIR / f"_work_{submission_id}"
    workdir.mkdir(parents=True, exist_ok=True)
    written: List[str] = []

    try:
        converted: List[Tuple[str, str]] = []
        for name, data in files:
            converted.extend(convert_one(name, data, workdir))

        if not converted:
            raise UnsupportedFile("No convertible files in the upload")

        # Only create the submission directory once everything converted, so a
        # failure does not leave a half-populated submission behind.
        target.mkdir(parents=True)
        for out_name, markdown in converted:
            (target / out_name).write_text(markdown, encoding="utf-8")
            written.append(out_name)
    finally:
        shutil.rmtree(workdir, ignore_errors=True)

    logger.info(
        "ingest.stored submission=%s files=%d", submission_id, len(written)
    )
    return written
