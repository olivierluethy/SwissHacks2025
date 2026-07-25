"""Job store behaviour: idempotency, cancellation and stale recovery."""

import pytest

import config
import jobs


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "JOBS_DB", tmp_path / "jobs.sqlite3")
    jobs.reset_for_tests()
    jobs.init()
    yield
    jobs.reset_for_tests()


def test_unknown_submission_has_no_job():
    assert jobs.get("nope") is None


def test_claim_creates_a_processing_job():
    assert jobs.claim("florida") is True
    job = jobs.get("florida")
    assert job.status == jobs.PROCESSING
    assert job.progress == 0


def test_second_claim_is_refused_while_running():
    """BUG-009: a double click used to start two tasks racing the same files."""
    assert jobs.claim("florida") is True
    assert jobs.claim("florida") is False


def test_claim_allowed_again_after_completion():
    jobs.claim("florida")
    jobs.finish("florida", {"title": "t"})
    assert jobs.claim("florida") is True


def test_claim_allowed_again_after_failure():
    jobs.claim("florida")
    jobs.fail("florida", "generate", "boom")
    assert jobs.claim("florida") is True


def test_finish_records_result_and_clears_error():
    jobs.claim("florida")
    jobs.fail("florida", "generate", "boom")
    jobs.claim("florida")
    jobs.finish("florida", {"title": "done"})
    job = jobs.get("florida")
    assert job.status == jobs.COMPLETED
    assert job.progress == 100
    assert job.error is None
    assert job.result == {"title": "done"}


def test_fail_records_step_and_error():
    jobs.claim("florida")
    jobs.fail("florida", "retrieval", "index missing")
    job = jobs.get("florida")
    assert job.status == jobs.FAILED
    assert job.step == "retrieval"
    assert "index missing" in job.error


def test_progress_updates_are_visible():
    jobs.claim("florida")
    jobs.update("florida", progress=42, step="summarising 3/7 documents")
    job = jobs.get("florida")
    assert job.progress == 42
    assert job.step == "summarising 3/7 documents"


def test_cancel_request_only_applies_to_running_jobs():
    assert jobs.request_cancel("florida") is False
    jobs.claim("florida")
    assert jobs.request_cancel("florida") is True
    assert jobs.is_cancel_requested("florida") is True


def test_cancel_flag_cleared_by_a_fresh_claim():
    jobs.claim("florida")
    jobs.request_cancel("florida")
    jobs.cancel("florida")
    jobs.claim("florida")
    assert jobs.is_cancel_requested("florida") is False


def test_recover_all_processing_fails_orphaned_jobs():
    """BUG-010: after a restart nothing can still be running."""
    jobs.claim("florida")
    jobs.claim("turkey")
    jobs.finish("turkey", {"title": "t"})

    recovered = jobs.recover_all_processing()

    assert recovered == 1
    assert jobs.get("florida").status == jobs.FAILED
    assert "interrupted" in jobs.get("florida").error
    assert jobs.get("turkey").status == jobs.COMPLETED


def test_recover_stale_leaves_fresh_jobs_alone():
    jobs.claim("florida")
    assert jobs.recover_stale(max_age_seconds=3600) == 0
    assert jobs.get("florida").status == jobs.PROCESSING


def test_to_api_shape():
    jobs.claim("florida")
    jobs.update("florida", progress=10, step="reading")
    payload = jobs.get("florida").to_api()
    assert set(payload) == {"id", "status", "progress", "step", "error", "updatedAt"}
    assert payload["id"] == "florida"
