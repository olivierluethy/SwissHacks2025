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
import re
from openai import OpenAI

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
from pydantic import BaseModel

# Set your OpenAI API key (ensure this key is available in your environment)
MODEL_NAME = "o3-mini"  # Or "gpt-4" if desired

app = FastAPI()

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


# Endpoints declared in other files
app.include_router(data_endpoints.router, prefix='')


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


class AnalysisRequest(BaseModel):
    folder_name: str


def read_all_files_from_folder(folder_name: str) -> str:
    """
    Reads all files (ignoring subfolders) in the provided folder and concatenates
    their contents into a single markdown string.
    """
    if not os.path.exists(folder_name):
        raise FileNotFoundError(f"Folder '{folder_name}' does not exist.")
    if not os.path.isdir(folder_name):
        raise NotADirectoryError(f"'{folder_name}' is not a directory.")

    combined_text = ""
    for file_name in os.listdir(folder_name):
        file_path = os.path.join(folder_name, file_name)
        if os.path.isfile(file_path):
            try:
                with open(file_path, encoding="utf8") as f:
                    file_contents = f.read()
                    combined_text += file_contents + "\n\n"
            except Exception as e:
                raise Exception(f"Error reading file {file_path}: {e}")
    return combined_text.strip()


def query_ai(prompt: str, model_name: str = MODEL_NAME) -> str:
    """
    Sends the provided prompt to the ChatGPT API and returns the raw text response.
    Removes any <think> sections that the model might include.
    """
    try:
        response = client.chat.completions.create(
            model=model_name, messages=[{"role": "user", "content": prompt}]
        )
        # Extract the assistant's message content.
        content = response.choices[0].message.content
        # Remove any embedded <think> sections if present.
        cleaned_content = re.sub(r"<think>.*?</think>\s*", "", content, flags=re.DOTALL)
        return cleaned_content.strip()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying the AI: {e}")


def clean_and_parse_json(text: str):
    """
    Cleans the text by removing markdown code fences and applying regex fixes
    for common JSON errors, then attempts to parse it.
    """
    # Remove markdown code blocks (```json or ```)
    text = re.sub(r"```json\s*|```\s*", "", text).strip()

    # Ensure keys are quoted properly:
    text = re.sub(r"([{,]\s*)(\w+)(\s*:)", r'\1"\2"\3', text)

    # Fix string values that might not be properly quoted
    text = re.sub(r':\s*"([^"]*)"([^,\]}])', r': "\1"\2', text)

    # Remove any trailing commas in objects or arrays
    text = re.sub(r",\s*([\]}])", r"\1", text)

    try:
        return json.loads(text)
    except Exception as error:
        print("Error parsing JSON:", error)
        print("Cleaned text was:", text)
        raise error


def generate_overview(markdown_text: str) -> str:
    """
    Queries the AI for the overview part of the JSON.
    The resulting JSON should only contain the "title" and "markdown" fields.
    """
    prompt = f"""
Generate your result following the JSON schema as defined below.
You must output ONLY valid JSON and nothing else.
You are only providing the overview: a 'title' and a Markdown 'summary'.

JSON Schema for this part:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Overview Schema",
  "type": "object",
  "required": ["title", "markdown"],
  "properties": {{
    "title": {{
      "type": "string",
      "description": "The main title of the analysis report"
    }},
    "markdown": {{
      "type": "string",
      "description": "Markdown-formatted summary of the analysis"
    }}
  }}
}}

Markdown input to analyze:
{markdown_text}

Ensure that you output only JSON following the schema.
"""
    return query_ai(prompt)


def generate_key_insights(markdown_text: str) -> str:
    """
    Queries the AI to generate the 'keyInsights' array.
    Each insight contains title, description, impact, and confidence.
    """
    prompt = f"""
Generate your result following the JSON schema as defined below.
You must output ONLY valid JSON and nothing else.
You are only providing the keyInsights array.

JSON Schema for keyInsights:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Key Insights Schema",
  "type": "array",
  "description": "A list of important insights derived from the data analysis",
  "items": {{
    "type": "object",
    "required": ["title", "description", "impact", "confidence"],
    "properties": {{
      "title": {{
        "type": "string",
        "description": "Short title or headline summarizing the insight"
      }},
      "description": {{
        "type": "string",
        "description": "Detailed explanation of the insight"
      }},
      "impact": {{
        "type": "string",
        "enum": ["positive", "negative"],
        "description": "Indicates whether the insight has a positive or negative effect on risk or performance"
      }},
      "confidence": {{
        "type": "number",
        "minimum": 0,
        "maximum": 1,
        "description": "Confidence score between 0 and 1 indicating the reliability of the insight"
      }}
    }}
  }}
}}

Markdown input to analyze:
{markdown_text}

Return only a JSON array that strictly adheres to the schema.
"""
    return query_ai(prompt)


def generate_tabs(markdown_text: str) -> str:
    """
    Queries the AI to generate the 'tabs' array.
    Each tab includes an id, a title, and content (either a JSON chart or an HTML string).
    """
    prompt = f"""
Generate your result following the JSON schema as defined below.
You must output ONLY valid JSON and nothing else.
You are only providing the tabs array.

JSON Schema for tabs:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tabs Schema",
  "type": "array",
  "description": "Different sections of the report, each representing a major analytical focus area",
  "items": {{
    "type": "object",
    "required": ["id", "title", "content"],
    "properties": {{
      "id": {{
        "type": "string",
        "description": "Unique identifier for the tab"
      }},
      "title": {{
        "type": "string",
        "description": "Title of the tab shown in the UI"
      }},
      "content": {{
        "type": "object",
        "required": ["type", "data"],
        "properties": {{
          "type": {{
            "type": "string",
            "enum": ["json", "html"],
            "description": "The format of the content: either a JSON chart or an HTML table/summary"
          }},
          "data": {{
            "description": "Chart or HTML content depending on the specified type",
            "oneOf": [
              {{
                "type": "object",
                "required": ["chartType", "title", "description", "data"],
                "properties": {{
                  "chartType": {{
                    "type": "string",
                    "enum": ["bar", "line", "pie"]
                  }},
                  "title": {{
                    "type": "string"
                  }},
                  "description": {{
                    "type": "string"
                  }},
                  "xAxisLabel": {{
                    "type": "string"
                  }},
                  "yAxisLabel": {{
                    "type": "string"
                  }},
                  "data": {{
                    "type": "array",
                    "items": {{
                      "type": "object",
                      "properties": {{
                        "value": {{
                          "type": "number",
                          "description": "Numerical value of the data point"
                        }}
                      }},
                      "required": ["value"],
                      "minProperties": 2
                    }}
                  }}
                }}
              }},
              {{
                "type": "string",
                "description": "HTML string containing formatted report content or tables"
              }}
            ]
          }}
        }}
      }}
    }}
  }}
}}

Markdown input to analyze:
{markdown_text}

Return only a JSON array that strictly adheres to the schema.
"""
    return query_ai(prompt)


@app.post("/analyze")
async def analyze(request: AnalysisRequest):
    # Read all files from the provided folder and combine their contents.
    try:
        markdown_text = read_all_files_from_folder(request.folder_name)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # Query for the overview (title and markdown summary)
        overview_json_str = generate_overview(markdown_text)
        print("Overview JSON:", overview_json_str)
        overview = clean_and_parse_json(overview_json_str)

        # Query for key insights array
        key_insights_json_str = generate_key_insights(markdown_text)
        print("Key Insights JSON:", key_insights_json_str)
        key_insights = clean_and_parse_json(key_insights_json_str)

        # Query for tabs array
        tabs_json_str = generate_tabs(markdown_text)
        print("Tabs JSON:", tabs_json_str)
        tabs = clean_and_parse_json(tabs_json_str)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing AI responses: {e}"
        )

    # Merge the parts into the final result following the complete schema
    final_result = {
        "title": overview.get("title", ""),
        "markdown": overview.get("markdown", ""),
        "keyInsights": key_insights,
        "tabs": tabs,
    }
    return final_result


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app)
