import os
import time
import json
import shutil
import zipfile
import asyncio
from uuid import uuid4
from datetime import datetime
from threading import Lock
from typing import List

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Path,
    BackgroundTasks,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from tempfile import NamedTemporaryFile
from excel_parsing import create_markdown_from_workbook_bytes


# -----------------------------
# Directory Setup
# -----------------------------
UPLOAD_DIR = "uploads"
PROCESSING_DIR = "processing"
PROCESSED_DIR = "processed"
ANALYSIS_DIR = "analysis"
PROGRESS_DIR = "progress"  # Persist progress per submission

for folder in [UPLOAD_DIR, PROCESSING_DIR, PROCESSED_DIR, ANALYSIS_DIR, PROGRESS_DIR]:
    os.makedirs(folder, exist_ok=True)

# Lock for progress file writes
progress_lock = Lock()


# -----------------------------
# Utility: Persistent progress
# -----------------------------
def get_progress_path(submission_id: str) -> str:
    return os.path.join(PROGRESS_DIR, f"progress_{submission_id}.json")


def load_progress(submission_id: str) -> dict:
    progress_path = get_progress_path(submission_id)
    if os.path.exists(progress_path):
        with open(progress_path, "r") as f:
            return json.load(f)
    return {}


def save_progress(submission_id: str, data: dict):
    progress_path = get_progress_path(submission_id)
    with progress_lock:
        with open(progress_path, "w") as f:
            json.dump(data, f, indent=2)




# -----------------------------
# FastAPI Application Initialization
# -----------------------------
app = FastAPI(title="File Processing API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve processed markdown files as static content (for testing)
app.mount("/results", StaticFiles(directory=PROCESSED_DIR), name="results")


# -----------------------------
# Submission and File Processing Endpoints
# -----------------------------
@app.post("/submissions")
async def create_submission(
    background_tasks: BackgroundTasks, file: UploadFile = File(...)
):
    # Save uploaded file to disk
    submission_id = str(uuid4())
    submission_folder = os.path.join(UPLOAD_DIR, submission_id)
    os.makedirs(submission_folder, exist_ok=True)
    file_path = os.path.join(submission_folder, file.filename)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    # Create submission record with initial progress saved to disk
    submission = {
        "id": submission_id,
        "status": "pending",
        "createdAt": datetime.utcnow().isoformat(),
        "files": [file.filename],
        "progress": "File uploaded, waiting for processing",
    }
    save_progress(submission_id, submission)
    # Start background processing task
    background_tasks.add_task(process_submission, submission_id, file_path)
    return submission


@app.get("/submissions")
async def list_submissions():
    # List all submissions by scanning PROGRESS_DIR
    submissions = []
    for fname in os.listdir(PROGRESS_DIR):
        if fname.startswith("progress_") and fname.endswith(".json"):
            submission_id = fname[len("progress_") : -len(".json")]
            submissions.append(load_progress(submission_id))
    return submissions


@app.get("/submissions/{submission_id}")
async def get_submission_status(submission_id: str = Path(...)):
    progress = load_progress(submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    return progress


@app.post("/submissions/{submission_id}/files")
async def upload_additional_files(
    submission_id: str = Path(...),
    background_tasks: BackgroundTasks = None,
    files: List[UploadFile] = File(...),
):
    progress = load_progress(submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    submission_folder = os.path.join(UPLOAD_DIR, submission_id)
    os.makedirs(submission_folder, exist_ok=True)
    for file in files:
        file_path = os.path.join(submission_folder, file.filename)
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        progress["files"].append(file.filename)
        background_tasks.add_task(process_submission, submission_id, file_path)
    progress["progress"] = "Additional files uploaded, processing started"
    save_progress(submission_id, progress)
    return progress


# -----------------------------
# WebSocket Endpoint for Live Status Updates
# -----------------------------
@app.websocket("/ws/{submission_id}")
async def websocket_endpoint(websocket: WebSocket, submission_id: str):
    await websocket.accept()
    try:
        while True:
            progress = load_progress(submission_id)
            await websocket.send_json(progress)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        print(f"WebSocket disconnected for submission {submission_id}")


# -----------------------------
# Background Processing Function
# -----------------------------
def process_submission(submission_id: str, file_path: str):
    """
    Process an uploaded file:
      - If compressed (zip), extract its contents.
      - Search for Excel (.xlsx) or PDF (.pdf) files.
      - For each, convert them to markdown.
      - Save the generated markdown file to the processed folder.
      - Move the original processed file to the analysis folder.
      - Update persistent progress along the way.
    """
    progress = load_progress(submission_id)
    progress["progress"] = "Processing started"
    save_progress(submission_id, progress)

    processing_subdir = os.path.join(PROCESSING_DIR, submission_id)
    os.makedirs(processing_subdir, exist_ok=True)

    extracted_files = []
    if zipfile.is_zipfile(file_path):
        progress["progress"] = "Extracting ZIP archive"
        save_progress(submission_id, progress)
        with zipfile.ZipFile(file_path, "r") as zip_ref:
            zip_ref.extractall(processing_subdir)
            extracted_files = [
                os.path.join(processing_subdir, name) for name in zip_ref.namelist()
            ]
    else:
        dest_path = os.path.join(processing_subdir, os.path.basename(file_path))
        shutil.copy(file_path, dest_path)
        extracted_files = [dest_path]

    results = {}
    for fpath in extracted_files:
        ext = os.path.splitext(fpath)[1].lower()
        result_md = ""
        if ext == ".xlsx":
            try:
                with open(fpath, "rb") as f:
                    file_bytes = f.read()
                result_md = create_markdown_from_workbook_bytes(file_bytes)
            except Exception as e:
                result_md = f"Error processing Excel file: {str(e)}"
        elif ext == ".pdf":
            try:
                with NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                    tmp.write(open(fpath, "rb").read())
                    tmp.flush()
                    tmp_filename = tmp.name
                from marker.converters.pdf import PdfConverter
                from marker.models import create_model_dict
                from marker.output import text_from_rendered

                converter = PdfConverter(artifact_dict=create_model_dict())
                rendered = converter(tmp_filename)
                text, _, images = text_from_rendered(rendered)
                os.remove(tmp_filename)
                result_md = text
            except Exception as e:
                result_md = f"Error processing PDF file: {str(e)}"
        else:
            continue
        if result_md:
            submission_processed_dir = os.path.join(PROCESSED_DIR, submission_id)
            os.makedirs(submission_processed_dir, exist_ok=True)
            base_name = os.path.splitext(os.path.basename(fpath))[0]
            out_file = os.path.join(submission_processed_dir, f"{base_name}.md")
            with open(out_file, "w", encoding="utf-8") as outf:
                outf.write(result_md)
            results[os.path.basename(fpath)] = out_file
        progress["progress"] = f"Processed {os.path.basename(fpath)}"
        save_progress(submission_id, progress)
        time.sleep(1)

    analysis_subdir = os.path.join(ANALYSIS_DIR, submission_id)
    os.makedirs(analysis_subdir, exist_ok=True)
    for f in extracted_files:
        shutil.move(f, analysis_subdir)

    progress["status"] = "complete"
    progress["progress"] = "All files processed"
    progress["results"] = results
    progress["processedAt"] = datetime.utcnow().isoformat()
    save_progress(submission_id, progress)


# -----------------------------
# Endpoints for File Operations
# -----------------------------
@app.get("/files/{submission_id}")
async def get_submission_files(submission_id: str = Path(...)):
    progress = load_progress(submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {"files": progress.get("files", []), "results": progress.get("results", {})}


@app.get("/files/{submission_id}/{file_name}/content")
async def get_file_content(submission_id: str = Path(...), file_name: str = Path(...)):
    # Look in the processed folder for a markdown file matching the base name.
    submission_processed_dir = os.path.join(PROCESSED_DIR, submission_id)
    base_name = os.path.splitext(file_name)[0]
    md_file = os.path.join(submission_processed_dir, f"{base_name}.md")
    if not os.path.exists(md_file):
        raise HTTPException(status_code=404, detail="Processed file not found")
    with open(md_file, "r", encoding="utf-8") as f:
        content = f.read()
    return {"text": content}


@app.get("/files/{submission_id}/{file_name}/download")
async def download_file(submission_id: str = Path(...), file_name: str = Path(...)):
    # Try to locate the original file in the analysis folder first.
    analysis_subdir = os.path.join(ANALYSIS_DIR, submission_id)
    file_path = os.path.join(analysis_subdir, file_name)
    if not os.path.exists(file_path):
        # Fall back to looking in the upload folder.
        upload_subdir = os.path.join(UPLOAD_DIR, submission_id)
        file_path = os.path.join(upload_subdir, file_name)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(
        file_path, media_type="application/octet-stream", filename=file_name
    )


@app.delete("/files/{submission_id}/{file_name}")
async def delete_file(submission_id: str = Path(...), file_name: str = Path(...)):
    # Remove file from analysis folder if exists.
    analysis_subdir = os.path.join(ANALYSIS_DIR, submission_id)
    file_path = os.path.join(analysis_subdir, file_name)
    if os.path.exists(file_path):
        os.remove(file_path)
    # Also remove from processed folder (if markdown exists)
    submission_processed_dir = os.path.join(PROCESSED_DIR, submission_id)
    base_name = os.path.splitext(file_name)[0]
    md_file = os.path.join(submission_processed_dir, f"{base_name}.md")
    if os.path.exists(md_file):
        os.remove(md_file)
    progress = load_progress(submission_id)
    if progress and "files" in progress:
        progress["files"] = [f for f in progress["files"] if f != file_name]
        save_progress(submission_id, progress)
    return {"success": True, "message": "File deleted successfully"}


@app.post("/files/{submission_id}/compare-contracts")
async def compare_contracts(submission_id: str = Path(...), payload: dict = None):
    if not payload or "previousFile" not in payload or "currentFile" not in payload:
        raise HTTPException(
            status_code=400, detail="Payload must include previousFile and currentFile"
        )
    # Simulate contract comparison.
    comparison = {
        "clauses": [
            {
                "id": "clause-1",
                "name": "Coverage Territory",
                "previousText": "This policy covers properties located in Florida, excluding Monroe County.",
                "currentText": "Now covers Florida excluding Monroe County and coastal areas within 5 miles.",
                "significance": "high",
                "changes": [
                    {"type": "modification", "text": "Added coastal area exclusion."}
                ],
            }
        ]
    }
    return comparison


@app.post("/files/{submission_id}/analyze-claims")
async def analyze_claims(submission_id: str = Path(...), payload: dict = None):
    if not payload or "fileName" not in payload:
        raise HTTPException(status_code=400, detail="Payload must include fileName")
    analysis = {
        "analysis": f"Simulated analysis of claims data from {payload['fileName']}."
    }
    return analysis


@app.post("/files/{submission_id}/analyze-exposure")
async def analyze_exposure(submission_id: str = Path(...), payload: dict = None):
    if not payload or "fileName" not in payload:
        raise HTTPException(status_code=400, detail="Payload must include fileName")
    analysis = {
        "analysis": f"Simulated analysis of exposure data from {payload['fileName']}."
    }
    return analysis


@app.post("/files/{submission_id}/extract-insights")
async def extract_insights(submission_id: str = Path(...), payload: dict = None):
    if not payload or "fileNames" not in payload:
        raise HTTPException(
            status_code=400, detail="Payload must include a list of fileNames"
        )
    insights = {
        "insights": f"Simulated insights extracted from files: {', '.join(payload['fileNames'])}."
    }
    return insights


# -----------------------------
# Dashboard Endpoint
# -----------------------------
@app.get("/dashboard/{submission_id}")
async def get_dashboard_data(submission_id: str = Path(...)):
    progress = load_progress(submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    # Simulated dashboard data combining progress and some dummy values.
    dashboard = {
        "contractRiskData": {"riskScore": 75},
        "layerData": {"layerCount": 3},
        "hurricaneData": {"peakWind": 120},
        "claimsData": {"totalClaims": 5},
        "exposureData": {"exposureValue": 1000000},
        "economicData": {"lossEstimate": 250000},
        "climateRiskData": {"climateIndex": 0.85},
        "contractChanges": progress.get("results", {}),
        "keyInsights": {"summary": "Processed successfully"},
        "underwriterResponse": progress.get("underwriterResponse", {}),
    }
    return dashboard


@app.post("/submissions/{submission_id}/response")
async def submit_underwriter_response(
    submission_id: str = Path(...), response_data: dict = None
):
    progress = load_progress(submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    progress["underwriterResponse"] = response_data or {}
    save_progress(submission_id, progress)
    return {"success": True, "message": "Underwriter response submitted successfully"}


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
