"""Upload ingestion (IMP-015). PDF conversion is not exercised - it needs marker-pdf."""

import io
import zipfile

import pytest

import config
import ingest


@pytest.fixture(autouse=True)
def dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "SUBMISSIONS_DIR", tmp_path / "submissions")
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path / "uploads")
    (tmp_path / "submissions").mkdir()
    (tmp_path / "uploads").mkdir()
    return tmp_path


HOSTILE_NAMES = [
    "../../etc/passwd",
    "..\\..\\windows\\system32",
    "/absolute/path.md",
    "....//....//x",
    "...",
    "",
]


@pytest.mark.parametrize("raw", HOSTILE_NAMES)
def test_safe_name_neutralises_paths(raw, tmp_path):
    """The guarantee is containment, not any particular spelling."""
    cleaned = ingest.safe_name(raw)
    assert cleaned  # never empty - callers use it as a filename
    assert "/" not in cleaned and "\\" not in cleaned
    assert not cleaned.startswith(".")
    # Joining it to a directory can never leave that directory.
    assert (tmp_path / cleaned).resolve().parent == tmp_path.resolve()


def test_safe_name_keeps_ordinary_filenames_readable():
    assert ingest.safe_name("2024_submission.xlsx") == "2024_submission.xlsx"
    assert ingest.safe_name("/uploads/exposure.md") == "exposure.md"


def test_text_file_is_stored_verbatim():
    written = ingest.store_submission("sub", [("notes.md", b"# Title\ncontent")])
    assert written == ["notes.md"]
    stored = (config.SUBMISSIONS_DIR / "sub" / "notes.md").read_text()
    assert stored == "# Title\ncontent"


def test_non_utf8_text_is_rejected_clearly():
    with pytest.raises(ingest.UnsupportedFile):
        ingest.store_submission("sub", [("notes.md", b"\xff\xfe\x00bad")])


def test_unsupported_extension_is_rejected():
    with pytest.raises(ingest.UnsupportedFile):
        ingest.store_submission("sub", [("photo.jpeg", b"\x00")])


def test_duplicate_submission_is_refused():
    ingest.store_submission("sub", [("a.md", b"x")])
    with pytest.raises(FileExistsError):
        ingest.store_submission("sub", [("b.md", b"y")])


def test_failed_conversion_leaves_no_partial_submission():
    with pytest.raises(ingest.UnsupportedFile):
        ingest.store_submission("sub", [("ok.md", b"fine"), ("bad.jpeg", b"\x00")])
    assert not (config.SUBMISSIONS_DIR / "sub").exists()


def test_workdir_is_cleaned_up():
    ingest.store_submission("sub", [("a.md", b"x")])
    assert not list(config.UPLOAD_DIR.glob("_work_*"))


def test_zip_members_are_extracted_and_converted():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("one.md", "first")
        archive.writestr("two.txt", "second")
        archive.writestr("skip.bin", "ignored")
    written = ingest.store_submission("sub", [("bundle.zip", buffer.getvalue())])
    assert sorted(written) == ["one.md", "two.txt"]


def test_zip_member_traversal_is_neutralised():
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("../../escape.md", "payload")
    written = ingest.store_submission("sub", [("bundle.zip", buffer.getvalue())])
    assert written == ["escape.md"]
    assert (config.SUBMISSIONS_DIR / "sub" / "escape.md").exists()


def test_excel_conversion_produces_markdown():
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet["A1"] = "Peril"
    sheet["B1"] = "Limit"
    sheet["A2"] = "Wind"
    sheet["B2"] = 1000
    buffer = io.BytesIO()
    workbook.save(buffer)

    written = ingest.store_submission("sub", [("exposure.xlsx", buffer.getvalue())])

    assert written == ["exposure.xlsx.md"]
    markdown = (config.SUBMISSIONS_DIR / "sub" / "exposure.xlsx.md").read_text()
    assert "Peril" in markdown and "Wind" in markdown
