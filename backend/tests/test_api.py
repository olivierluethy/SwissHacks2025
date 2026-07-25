"""End-to-end API tests through FastAPI's TestClient. No OpenAI calls."""

import json

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client(tmp_path, monkeypatch):
    import config

    monkeypatch.setattr(config, "JOBS_DB", tmp_path / "jobs.sqlite3")
    monkeypatch.setattr(config, "SUBMISSIONS_DIR", tmp_path / "submissions")
    monkeypatch.setattr(config, "PROCESSED_DIR", tmp_path / "processed")
    monkeypatch.setattr(config, "AI_CACHED_DIR", tmp_path / "ai_cached")
    monkeypatch.setattr(config, "FEEDBACK_DIR", tmp_path / "feedback")
    monkeypatch.setattr(config, "UPLOAD_DIR", tmp_path / "uploads")
    monkeypatch.setattr(config, "API_TOKEN", None)
    for name in ("submissions", "processed", "ai_cached", "feedback", "uploads"):
        (tmp_path / name).mkdir()

    import jobs

    jobs.reset_for_tests()

    import main

    # Never let a test reach the network.
    monkeypatch.setattr(main.retrieval, "warmup", lambda: None)
    monkeypatch.setattr(main.pipeline, "run", lambda submission_id: None)

    (tmp_path / "submissions" / "florida").mkdir()
    (tmp_path / "submissions" / "florida" / "a.md").write_text("Premium: 100")

    with TestClient(main.app) as test_client:
        yield test_client

    jobs.reset_for_tests()


def test_health(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert "retrievalIndex" in body


def test_list_submissions_reports_pending(client):
    body = client.get("/submissions").json()
    assert body == [{"id": "florida", "status": "pending", "progress": 0}]


def test_status_404_for_unknown_submission(client):
    assert client.get("/submissions/nope/status").status_code == 404


def test_process_starts_a_job(client):
    response = client.post("/submissions/florida/process")
    assert response.status_code == 200
    status = client.get("/submissions/florida/status").json()
    assert status["status"] == "processing"


def test_double_process_is_rejected(client):
    """BUG-009: the second click used to start a competing background task."""
    assert client.post("/submissions/florida/process").status_code == 200
    assert client.post("/submissions/florida/process").status_code == 409


def test_process_unknown_submission_is_404(client):
    assert client.post("/submissions/ghost/process").status_code == 404


def test_cancel_requires_a_running_job(client):
    assert client.post("/submissions/florida/cancel").status_code == 409
    client.post("/submissions/florida/process")
    assert client.post("/submissions/florida/cancel").status_code == 200


def test_failed_status_is_visible_with_its_error(client):
    """BUG-007: failures used to be reported as 'pending'."""
    import jobs

    client.post("/submissions/florida/process")
    jobs.fail("florida", "generate", "model exploded")

    listed = client.get("/submissions").json()[0]
    assert listed["status"] == "failed"
    assert "model exploded" in listed["error"]

    status = client.get("/submissions/florida/status").json()
    assert status["status"] == "failed"
    assert "model exploded" in status["error"]


def test_dashboard_404_when_missing(client):
    assert client.get("/dashboards/florida_dashboard").status_code == 404


def test_dashboard_served_when_present(client, tmp_path):
    (tmp_path / "ai_cached" / "florida_dashboard.json").write_text(
        json.dumps({"title": "T", "markdown": "M", "keyInsights": [], "tabs": []})
    )
    body = client.get("/dashboards/florida_dashboard").json()
    assert body["title"] == "T"


def test_feedback_is_persisted(client, tmp_path):
    """BUG-019: feedback used to be printed and thrown away."""
    response = client.post(
        "/dashboards/florida_dashboard/feedback",
        json={"contentType": "insight", "isPositive": False, "feedbackText": "wrong"},
    )
    assert response.status_code == 200
    lines = (tmp_path / "feedback" / "florida_dashboard.jsonl").read_text().splitlines()
    assert json.loads(lines[0])["feedbackText"] == "wrong"


def test_chat_requires_a_message(client):
    response = client.post("/dashboards/florida_dashboard/chat", json={"message": "  "})
    assert response.status_code == 400


def test_get_file_contents_rejects_traversal(client):
    """SEC-001: verified live against the old build - this returned /etc/passwd."""
    response = client.get(
        "/get-file-contents", params={"filename": "../../../../../../../etc/passwd"}
    )
    assert response.status_code == 404
    assert "root:" not in response.text


def test_cors_does_not_reflect_arbitrary_origins(client):
    """SEC-003: an arbitrary Origin used to come back with credentials enabled."""
    response = client.options(
        "/submissions",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.headers.get("access-control-allow-origin") != "https://evil.example"


# ---------------------------------------------------------------------------
# Auth (SEC-002)
# ---------------------------------------------------------------------------
@pytest.fixture
def secured_client(client, monkeypatch):
    import config

    monkeypatch.setattr(config, "API_TOKEN", "s3cret")
    return client


def test_protected_route_rejects_missing_token(secured_client):
    assert secured_client.get("/submissions").status_code == 401


def test_protected_route_rejects_wrong_token(secured_client):
    response = secured_client.get(
        "/submissions", headers={"Authorization": "Bearer wrong"}
    )
    assert response.status_code == 401


def test_protected_route_accepts_correct_token(secured_client):
    response = secured_client.get(
        "/submissions", headers={"Authorization": "Bearer s3cret"}
    )
    assert response.status_code == 200


def test_health_is_reachable_without_a_token(secured_client):
    assert secured_client.get("/health").status_code == 200
