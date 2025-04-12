import os
import json
from threading import Lock
from typing import List

from fastapi import (
    FastAPI,
    UploadFile,
    File,
    HTTPException,
    Path,
    BackgroundTasks,
)
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles


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


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
