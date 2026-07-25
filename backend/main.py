"""ReInsight API.

Analysis pipeline, dashboard access, chat and report export.

See docs/improvements.md for the audit this structure came out of. The short
version: the analysis now runs as a map-reduce over cached per-document
summaries (pipeline.py), model output is schema-validated rather than
regex-repaired (llm.py + schemas.py), job state lives in SQLite rather than in
loose JSON files (jobs.py), and no handler performs blocking work on the event
loop.
"""

from __future__ import annotations

import json
import logging
import os
import re
import tempfile
from datetime import datetime, timezone
from typing import List, Optional

import uvicorn
from fastapi import (
    BackgroundTasks,
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Path as PathParam,
    Query,
    UploadFile,
)
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, PlainTextResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import config
import ingest
import jobs
import llm
import pipeline
import prompts
import report
import retrieval
from auth import require_token
from schemas import ChatChartDecision, Overview

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
)
logger = logging.getLogger("archre")

config.ensure_runtime_dirs()

app = FastAPI(title="ReInsight API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    # SEC-003: an explicit allowlist. Reflecting an arbitrary Origin while
    # allow_credentials is on let any site drive this API.
    allow_origins=config.CORS_ALLOW_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# SEC-007: results are only served statically when explicitly enabled.
if os.environ.get("SERVE_RESULTS_STATICALLY", "").lower() in ("1", "true", "yes"):
    app.mount("/results", StaticFiles(directory=str(config.PROCESSED_DIR)), name="results")

_SAFE_ID_RE = re.compile(r"[^A-Za-z0-9._-]")


def safe_id(value: str) -> str:
    cleaned = _SAFE_ID_RE.sub("_", value).lstrip(".")
    if not cleaned:
        raise HTTPException(status_code=400, detail="Invalid identifier")
    return cleaned


def submission_id_from_dashboard(dashboard_id: str) -> str:
    return safe_id(dashboard_id).rsplit("_dashboard", 1)[0]


@app.on_event("startup")
def _startup() -> None:
    jobs.init()
    # BUG-010: a job still marked processing cannot have a live task behind it,
    # because the task lived in the process that just died.
    recovered = jobs.recover_all_processing()
    if recovered:
        logger.warning("startup.recovered_jobs count=%d", recovered)
    try:
        retrieval.warmup()  # IMP-002
    except Exception as e:
        logger.error("startup.retrieval_warmup_failed error=%s", e)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model": config.MODEL_NAME,
        "summaryModel": config.SUMMARY_MODEL_NAME,
        "retrievalIndex": "ready" if retrieval.index_exists() else "missing",
        "authRequired": bool(config.API_TOKEN),
    }


# ---------------------------------------------------------------------------
# Submissions
# ---------------------------------------------------------------------------
def _list_submission_ids() -> List[str]:
    if not config.SUBMISSIONS_DIR.is_dir():
        return []
    return sorted(p.name for p in config.SUBMISSIONS_DIR.iterdir() if p.is_dir())


@app.get("/submissions", dependencies=[Depends(require_token)])
def list_submissions() -> List[dict]:
    """BUG-007: report the real job state. Collapsing everything that was not
    'completed' into 'pending' made a failed run look like one never started."""
    known = {job.submission_id: job for job in jobs.all_jobs()}
    result = []
    for submission_id in _list_submission_ids():
        job = known.get(submission_id)
        if job is None:
            result.append({"id": submission_id, "status": jobs.PENDING, "progress": 0})
            continue
        entry = job.to_api()
        if job.status == jobs.COMPLETED:
            entry["dashboardId"] = f"{submission_id}_dashboard"
        result.append(entry)
    return result


@app.get("/submissions/{submission_id}/status", dependencies=[Depends(require_token)])
def get_submission_status(submission_id: str = PathParam(...)) -> dict:
    submission_id = safe_id(submission_id)
    job = jobs.get(submission_id)
    if job is None:
        if not (config.SUBMISSIONS_DIR / submission_id).is_dir():
            raise HTTPException(status_code=404, detail="Submission not found")
        return {
            "status": jobs.PENDING,
            "progress": 0,
            "step": None,
            "error": None,
            "dashboardId": f"{submission_id}_dashboard",
        }
    payload = job.to_api()
    payload["dashboardId"] = f"{submission_id}_dashboard"
    return payload


@app.post("/submissions/{submission_id}/process", dependencies=[Depends(require_token)])
def process_submission_endpoint(
    background_tasks: BackgroundTasks,
    submission_id: str = PathParam(...),
) -> dict:
    submission_id = safe_id(submission_id)
    if not (config.SUBMISSIONS_DIR / submission_id).is_dir():
        raise HTTPException(status_code=404, detail="Submission not found")

    # BUG-009: atomic claim. A second start while one is in flight is refused
    # instead of silently racing the first.
    if not jobs.claim(submission_id):
        raise HTTPException(
            status_code=409,
            detail="This submission is already being processed.",
        )

    background_tasks.add_task(pipeline.run, submission_id)
    return {"submission_id": submission_id, "status": "processing started"}


@app.post("/submissions", status_code=201, dependencies=[Depends(require_token)])
async def create_submission(
    submission_id: str = Form(...),
    files: List[UploadFile] = File(...),
) -> dict:
    """IMP-015: upload documents and have them converted on the server.

    Excel goes through the BFS table extractor and PDF through marker-pdf - the
    code that previously only ran as a manual script.
    """
    submission_id = safe_id(submission_id)
    if (config.SUBMISSIONS_DIR / submission_id).exists():
        raise HTTPException(status_code=409, detail="Submission already exists")

    payloads: List[tuple] = []
    total = 0
    for upload in files:
        data = await upload.read()
        total += len(data)
        if total > ingest.MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Upload too large")
        payloads.append((upload.filename or "unnamed", data))

    try:
        # Conversion is CPU-bound and blocking; keep it off the event loop.
        written = await run_in_threadpool(
            ingest.store_submission, submission_id, payloads
        )
    except ingest.UnsupportedFile as e:
        raise HTTPException(status_code=415, detail=str(e))
    except FileExistsError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        logger.exception("ingest.failed submission=%s", submission_id)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return {"id": submission_id, "files": written, "status": jobs.PENDING}


@app.post("/submissions/{submission_id}/cancel", dependencies=[Depends(require_token)])
def cancel_submission(submission_id: str = PathParam(...)) -> dict:
    """IMP-010: ask a running analysis to stop at its next checkpoint."""
    submission_id = safe_id(submission_id)
    if not jobs.request_cancel(submission_id):
        raise HTTPException(status_code=409, detail="No run in progress.")
    return {"submission_id": submission_id, "status": "cancelling"}


# ---------------------------------------------------------------------------
# Dashboards
# ---------------------------------------------------------------------------
def _dashboard_path(dashboard_id: str):
    return config.AI_CACHED_DIR / f"{safe_id(dashboard_id)}.json"


def _load_dashboard(dashboard_id: str) -> dict:
    path = _dashboard_path(dashboard_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return json.loads(path.read_text(encoding="utf-8"))


@app.get("/dashboards/{dashboard_id}", dependencies=[Depends(require_token)])
def get_dashboard(dashboard_id: str = PathParam(...)) -> dict:
    return _load_dashboard(dashboard_id)


@app.post("/dashboards/{dashboard_id}/feedback", dependencies=[Depends(require_token)])
def submit_feedback(
    dashboard_id: str = PathParam(...), feedback: dict = Body(...)
) -> dict:
    """BUG-019: feedback used to be printed and discarded."""
    record = {
        "dashboardId": dashboard_id,
        "receivedAt": datetime.now(timezone.utc).isoformat(),
        **{k: v for k, v in feedback.items() if k != "dashboardId"},
    }
    path = config.FEEDBACK_DIR / f"{safe_id(dashboard_id)}.jsonl"
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(record) + "\n")
    logger.info(
        "feedback.stored dashboard=%s type=%s positive=%s",
        dashboard_id,
        feedback.get("contentType"),
        feedback.get("isPositive"),
    )
    return {"status": "success", "message": "Feedback submitted successfully."}


@app.post("/dashboards/{dashboard_id}/ai-response", dependencies=[Depends(require_token)])
def get_ai_response_to_feedback(
    dashboard_id: str = PathParam(...), feedback: dict = Body(...)
) -> dict:
    """Revise the overview section in response to reviewer feedback.

    COST-003: this used to regenerate the entire dashboard - current dashboard +
    context + the whole submission in, a complete dashboard out - on every
    thumbs click. It now revises one section from cached summaries.
    """
    dashboard = _load_dashboard(dashboard_id)
    submission_id = submission_id_from_dashboard(dashboard_id)

    try:
        summaries_text = pipeline.load_summaries_text(submission_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Submission folder not found")
    except llm.AIQueryError as e:
        raise HTTPException(status_code=502, detail=str(e))

    current = json.dumps(
        {"title": dashboard.get("title"), "markdown": dashboard.get("markdown")},
        indent=2,
    )
    try:
        revised = llm.structured(
            prompts.feedback_update(
                section=str(feedback.get("contentType", "overview")),
                feedback_text=str(feedback.get("feedbackText", "")),
                positive=bool(feedback.get("isPositive", True)),
                current=current,
                summaries=summaries_text,
            ),
            Overview,
            label="feedback",
            use_cache=False,
        )
    except llm.AIQueryError as e:
        raise HTTPException(status_code=502, detail=str(e))

    dashboard["title"] = revised.title
    dashboard["markdown"] = revised.markdown

    text = json.dumps(dashboard, indent=2)
    _dashboard_path(dashboard_id).write_text(text, encoding="utf-8")
    (config.PROCESSED_DIR / f"{safe_id(dashboard_id)}_result.json").write_text(
        text, encoding="utf-8"
    )
    return dashboard


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
def _chat_path(dashboard_id: str):
    return config.AI_CACHED_DIR / f"{safe_id(dashboard_id)}_chat.json"


def _load_chat(dashboard_id: str) -> List[dict]:
    path = _chat_path(dashboard_id)
    if not path.exists():
        return []
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("chat.history_corrupt dashboard=%s", dashboard_id)
        return []


def _save_chat(dashboard_id: str, history: List[dict]) -> None:
    _chat_path(dashboard_id).write_text(
        json.dumps(history, indent=2), encoding="utf-8"
    )


def _render_history(history: List[dict], limit: int = 10) -> str:
    """COST-002: only the recent turns are sent, not an unbounded transcript."""
    recent = history[-limit:]
    return "\n\n".join(f"{m.get('role')}: {m.get('content', '')}" for m in recent)


@app.get("/dashboards/{dashboard_id}/chat", dependencies=[Depends(require_token)])
def get_chat_history(dashboard_id: str = PathParam(...)) -> List[dict]:
    return _load_chat(dashboard_id)


@app.delete("/dashboards/{dashboard_id}/chat", dependencies=[Depends(require_token)])
def delete_chat_history(dashboard_id: str = PathParam(...)) -> dict:
    path = _chat_path(dashboard_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Chat history not found.")
    path.unlink()
    return {"status": "success", "message": "Chat history deleted."}


def _prepare_chat(dashboard_id: str, message_text: str):
    submission_id = submission_id_from_dashboard(dashboard_id)
    if not (config.SUBMISSIONS_DIR / submission_id).is_dir():
        raise HTTPException(status_code=404, detail="Submission folder not found")

    history = _load_chat(dashboard_id)
    summaries_text = pipeline.load_summaries_text(submission_id)
    try:
        context = retrieval.build_context(f"{summaries_text}\n\n{message_text}")
    except retrieval.IndexMissingError:
        context = ""
    prompt = prompts.chat_answer(
        message_text, summaries_text, context, _render_history(history)
    )
    return history, prompt


@app.post("/dashboards/{dashboard_id}/chat", dependencies=[Depends(require_token)])
def send_chat_message(
    dashboard_id: str = PathParam(...), payload: dict = Body(...)
) -> dict:
    """Non-streaming chat. BUG-005: sync handler - all work below blocks."""
    message_text = str(payload.get("message", "")).strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message text is required.")

    try:
        history, prompt = _prepare_chat(dashboard_id, message_text)
        answer = "".join(llm.stream_text(prompt, label="chat"))
        chart = _maybe_chart(message_text, answer)
    except llm.AIQueryError as e:
        raise HTTPException(status_code=502, detail=f"Error querying the AI: {e}")

    return _append_exchange(dashboard_id, history, message_text, answer, chart)


def _maybe_chart(message_text: str, answer: str) -> Optional[dict]:
    keywords = ("chart", "graph", "visual", "show", "display", "plot")
    if not any(word in message_text.lower() for word in keywords):
        return None
    try:
        decision = llm.structured(
            prompts.chat_chart(message_text, answer),
            ChatChartDecision,
            label="chat:chart",
            use_cache=False,
        )
    except llm.AIQueryError as e:
        logger.warning("chat.chart_failed error=%s", e)
        return None
    if decision.wants_chart and decision.chart and decision.chart.data:
        return decision.chart.model_dump()
    return None


def _append_exchange(
    dashboard_id: str,
    history: List[dict],
    message_text: str,
    answer: str,
    chart: Optional[dict],
) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    history.append({"role": "user", "content": message_text, "timestamp": now})
    assistant = {
        "role": "assistant",
        "content": answer,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if chart:
        assistant["chart"] = chart
    history.append(assistant)
    _save_chat(dashboard_id, history)
    return assistant


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/dashboards/{dashboard_id}/chat/stream", dependencies=[Depends(require_token)])
def stream_chat_message(
    dashboard_id: str = PathParam(...), payload: dict = Body(...)
) -> StreamingResponse:
    """IMP-003: stream the answer as it is produced.

    Total duration is unchanged; time-to-first-word drops from the length of the
    whole call to a couple of seconds, which is most of the perceived problem.
    """
    message_text = str(payload.get("message", "")).strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message text is required.")

    history, prompt = _prepare_chat(dashboard_id, message_text)

    def generate():
        collected: List[str] = []
        try:
            for piece in llm.stream_text(prompt, label="chat:stream"):
                collected.append(piece)
                yield _sse("token", {"text": piece})
            answer = "".join(collected)
            chart = _maybe_chart(message_text, answer)
            assistant = _append_exchange(
                dashboard_id, history, message_text, answer, chart
            )
            if chart:
                yield _sse("chart", chart)
            yield _sse("done", assistant)
        except llm.AIQueryError as e:
            yield _sse("error", {"detail": str(e)})
        except Exception as e:  # never leave the stream hanging open
            logger.exception("chat.stream_failed dashboard=%s", dashboard_id)
            yield _sse("error", {"detail": f"{type(e).__name__}: {e}"})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------
class RelatedFile(BaseModel):
    filename: str
    confidence: float


class InputTextRequest(BaseModel):
    input_text: str
    k: int = 5


@app.post(
    "/top_k_related_files",
    response_model=List[RelatedFile],
    dependencies=[Depends(require_token)],
)
def top_k_related_files(request: InputTextRequest) -> List[RelatedFile]:
    try:
        results = retrieval.search_files(request.input_text, request.k)
    except retrieval.IndexMissingError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return [RelatedFile(filename=name, confidence=score) for name, score in results]


@app.post(
    "/top_k_related_files_contents",
    response_class=PlainTextResponse,
    dependencies=[Depends(require_token)],
)
def top_k_related_files_contents(request: InputTextRequest) -> str:
    try:
        return retrieval.build_context(request.input_text, k=request.k)
    except retrieval.IndexMissingError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.get(
    "/get-file-contents",
    response_class=PlainTextResponse,
    dependencies=[Depends(require_token)],
)
def get_file_contents(filename: str) -> str:
    """SEC-001: confined to the corpus directory. `?filename=../../../etc/passwd`
    used to return /etc/passwd from an unauthenticated endpoint."""
    try:
        path = retrieval.resolve_within_corpus(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found.")
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")
    try:
        return path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")


# ---------------------------------------------------------------------------
# Reports
# ---------------------------------------------------------------------------
@app.post("/generate-pdf", dependencies=[Depends(require_token)])
def generate_report_endpoint(
    payload: dict,
    output_format: str = Query("pdf", description="Output format: 'pdf' or 'txt'"),
) -> FileResponse:
    """BUG-016: sync handler - rendering blocks. BUG-015: unique output path."""
    if output_format.lower() not in ("pdf", "txt"):
        raise HTTPException(status_code=400, detail="output_format must be 'pdf' or 'txt'")

    temp_dir = tempfile.mkdtemp(prefix="report_")
    file_path = report.generate_report(
        payload,
        output_format=output_format,
        output_filepath=os.path.join(temp_dir, "report_output"),
    )
    media_type = "application/pdf" if output_format.lower() == "pdf" else "text/plain"
    return FileResponse(
        path=file_path, media_type=media_type, filename=os.path.basename(file_path)
    )


if __name__ == "__main__":
    uvicorn.run(app, host=config.HOST, port=config.PORT)
