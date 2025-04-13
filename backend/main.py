import os
import json
import re
import hashlib
import asyncio
from threading import Lock

from fastapi import FastAPI, HTTPException, Path
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import OpenAI

# For RAG
from data import data_endpoints
from data.data_endpoints import get_top_k_related_files_contents

# Set your OpenAI API key (ensure this key is available in your environment)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL_NAME = "o3-mini"  # Or "gpt-4" if desired

app = FastAPI(title="Async File Processing API with AI Caching and Progress")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------
# Directory Setup
# -----------------------------
UPLOAD_DIR = "uploads"
PROCESSING_DIR = "processing"
PROCESSED_DIR = "processed"
ANALYSIS_DIR = "analysis"
AI_CACHED_DIR = "data/ai_cached"  # Cache AI results and dashboards
PROGRESS_DIR = "data/progress"  # Persist progress per submission
SUBMISSIONS_DIR = "data/submissions_processed"  # Processed submissions

for folder in [
    UPLOAD_DIR,
    PROCESSING_DIR,
    PROCESSED_DIR,
    ANALYSIS_DIR,
    AI_CACHED_DIR,
    SUBMISSIONS_DIR,
    PROGRESS_DIR,
]:
    os.makedirs(folder, exist_ok=True)

# Lock for progress file writes
progress_lock = Lock()


# -----------------------------
# Utility: Persistent Progress
# -----------------------------
def get_progress_path(submission_id: str) -> str:
    return os.path.join(PROGRESS_DIR, f"progress_{submission_id}.json")


def load_progress(submission_id: str) -> dict:
    progress_path = get_progress_path(submission_id)
    if os.path.exists(progress_path):
        with open(progress_path, "r") as f:
            return json.load(f)
    return {"status": "pending", "progress": 0, "results": {}}


def save_progress(submission_id: str, data: dict):
    progress_path = get_progress_path(submission_id)
    with progress_lock:
        with open(progress_path, "w") as f:
            json.dump(data, f, indent=2)


# Serve processed markdown files as static content (for testing)
app.mount("/results", StaticFiles(directory=PROCESSED_DIR), name="results")


# Endpoints declared in other files
app.include_router(data_endpoints.router, prefix="")


# -----------------------------
# Submission Endpoints
# -----------------------------
@app.get("/submissions")
async def list_submissions():
    submissions = []
    for fname in os.listdir(SUBMISSIONS_DIR):
        submission_path = os.path.join(SUBMISSIONS_DIR, fname)
        if os.path.isdir(submission_path):
            if os.path.exists(get_progress_path(fname)):
                progress = await asyncio.to_thread(load_progress, fname)
                if progress.get("status") == "completed":
                    submissions.append(
                        {
                            "id": fname,
                            "status": "completed",
                            "dashboardId": fname + "_dashboard",
                        }
                    )
                else:
                    submissions.append({"id": fname, "status": "pending"})
            else:
                submissions.append({"id": fname})
    return submissions


@app.get("/submissions/{submission_id}/status")
async def get_submission_status(submission_id: str = Path(...)):
    progress = await asyncio.to_thread(load_progress, submission_id)
    if not progress:
        raise HTTPException(status_code=404, detail="Submission not found")
    return {
        "status": progress.get("status", "pending"),
        "progress": progress.get("progress", 0),
        "dashboardId": submission_id + "_dashboard",
    }


@app.get("/dashboards/{dashboard_id}")
async def get_dashboard(dashboard_id: str = Path(...)):
    dashboard_file = os.path.join(AI_CACHED_DIR, f"{dashboard_id}.json")
    if not os.path.exists(dashboard_file):
        raise HTTPException(status_code=404, detail="Dashboard not found")
    with open(dashboard_file, "r") as f:
        dashboard_data = json.load(f)
    return dashboard_data


# -----------------------------
# AI Caching Helpers
# -----------------------------
def get_cache_filename(query_type: str, input_text: str) -> str:
    """Generate a cache filename based on query type and input content."""
    key = f"{query_type}_{input_text}"
    hash_key = hashlib.md5(key.encode("utf-8")).hexdigest()
    return os.path.join(AI_CACHED_DIR, f"{hash_key}_{query_type}.json")


def cached_ai_query(prompt: str, query_type: str, submission_id: str) -> str:
    """
    Check if a cached AI response exists for the prompt and query type.
    If so, return it; otherwise, call the AI API, cache and return the result.
    """
    cache_file = get_cache_filename(query_type, prompt)
    if os.path.exists(cache_file):
        with open(cache_file, "r") as f:
            cached_response = json.load(f)
        return cached_response["response"]

    try:
        response = client.chat.completions.create(
            model=MODEL_NAME, messages=[{"role": "user", "content": prompt}]
        )
        content = response.choices[0].message.content
        # Clean up any <think> blocks if present
        cleaned_content = re.sub(
            r"<think>.*?</think>\s*", "", content, flags=re.DOTALL
        ).strip()
        with open(cache_file, "w") as f:
            json.dump({"response": cleaned_content}, f, indent=2)
        return cleaned_content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying the AI: {e}")


# -----------------------------
# AI Query Functions
# -----------------------------
def generate_overview(markdown_text: str, submission_id: str, context: str) -> str:
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
    "title": {{"type": "string", "description": "The main title of the analysis report"}},
    "markdown": {{"type": "string", "description": "Markdown-formatted summary of the analysis"}}
  }}
}}

Use the following context:
{context}

Markdown input to analyze:
{markdown_text}

Ensure that you output only JSON following the schema.
"""
    return cached_ai_query(prompt, "overview", submission_id)


def generate_key_insights(markdown_text: str, submission_id: str, context: str) -> str:
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
      "title": {{"type": "string", "description": "Short title or headline summarizing the insight"}},
      "description": {{"type": "string", "description": "Detailed explanation of the insight"}},
      "impact": {{"type": "string", "enum": ["positive", "negative"], "description": "Indicates whether the insight has a positive or negative effect on risk or performance"}},
      "confidence": {{"type": "number", "minimum": 0, "maximum": 1, "description": "Confidence score between 0 and 1 indicating the reliability of the insight"}}
    }}
  }}
}}

Use the following context:
{context}

Markdown input to analyze:
{markdown_text}

Return only a JSON array that strictly adheres to the schema.
"""
    return cached_ai_query(prompt, "key_insights", submission_id)


def generate_tabs(markdown_text: str, submission_id: str, context: str) -> str:
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
      "id": {{"type": "string", "description": "Unique identifier for the tab"}},
      "title": {{"type": "string", "description": "Title of the tab shown in the UI"}},
      "content": {{
        "type": "object",
        "required": ["type", "data"],
        "properties": {{
          "type": {{"type": "string", "enum": ["json", "html"], "description": "The format of the content: either a JSON chart or an HTML table/summary"}},
          "data": {{
            "description": "Chart or HTML content depending on the specified type",
            "oneOf": [
              {{
                "type": "object",
                "required": ["chartType", "title", "description", "data"],
                "properties": {{
                  "chartType": {{"type": "string", "enum": ["bar", "line", "pie"]}},
                  "title": {{"type": "string"}},
                  "description": {{"type": "string"}},
                  "xAxisLabel": {{"type": "string"}},
                  "yAxisLabel": {{"type": "string"}},
                  "data": {{
                    "type": "array",
                    "items": {{
                      "type": "object",
                      "properties": {{
                        "value": {{"type": "number", "description": "Numerical value of the data point"}}
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

Use the following context:
{context}

Markdown input to analyze:
{markdown_text}

Return only a JSON array that strictly adheres to the schema.
"""
    return cached_ai_query(prompt, "tabs", submission_id)


# -----------------------------
# Utility: Read Files from Folder (Blocking)
# -----------------------------
def read_all_files_from_folder(folder_name: str) -> str:
    """
    Reads all files (ignoring subfolders) in the provided folder and concatenates
    their contents into a single Markdown string.
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


def clean_and_parse_json(text: str):
    """
    Cleans the text by removing markdown code fences and applying regex fixes
    for common JSON errors, then attempts to parse it.
    """
    text = re.sub(r"```json\s*|```\s*", "", text).strip()
    text = re.sub(r"([{,]\s*)(\w+)(\s*:)", r'\1"\2"\3', text)
    text = re.sub(r':\s*"([^"]*)"([^,\]}])', r': "\1"\2', text)
    text = re.sub(r",\s*([\]}])", r"\1", text)
    try:
        return json.loads(text)
    except Exception as error:
        print("Error parsing JSON:", error)
        print("Cleaned text was:", text)
        raise error


# -----------------------------
# Async Process Submission Endpoint
# -----------------------------
@app.post("/submissions/{submission_id}/process")
async def process_submission(submission_id: str = Path(...)):
    # Load and update progress asynchronously
    progress = await asyncio.to_thread(load_progress, submission_id)
    progress.update({"status": "in_progress", "progress": 0, "results": {}})
    await asyncio.to_thread(save_progress, submission_id, progress)

    submission_folder = os.path.join(SUBMISSIONS_DIR, submission_id)
    if not os.path.exists(submission_folder):
        raise HTTPException(status_code=404, detail="Submission folder not found")

    try:
        # Read all files (offloaded to a thread)
        markdown_text = await asyncio.to_thread(
            read_all_files_from_folder, submission_folder
        )
        context = get_top_k_related_files_contents(markdown_text, k=10)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # Generate Overview (update progress to 33%)
        overview_json_str = await asyncio.to_thread(
            generate_overview, markdown_text, submission_id, context
        )
        print("Overview JSON:", overview_json_str)
        overview = await asyncio.to_thread(clean_and_parse_json, overview_json_str)
        progress["results"]["overview"] = overview
        progress["progress"] = 33
        await asyncio.to_thread(save_progress, submission_id, progress)

        # Generate Key Insights (update progress to 66%)
        key_insights_json_str = await asyncio.to_thread(
            generate_key_insights, markdown_text, submission_id, context
        )
        print("Key Insights JSON:", key_insights_json_str)
        key_insights = await asyncio.to_thread(
            clean_and_parse_json, key_insights_json_str
        )
        progress["results"]["keyInsights"] = key_insights
        progress["progress"] = 66
        await asyncio.to_thread(save_progress, submission_id, progress)

        # Generate Tabs (update progress to 100%)
        tabs_json_str = await asyncio.to_thread(
            generate_tabs, markdown_text, submission_id, context
        )
        print("Tabs JSON:", tabs_json_str)
        tabs = await asyncio.to_thread(clean_and_parse_json, tabs_json_str)
        progress["results"]["tabs"] = tabs
        progress["progress"] = 100
        progress["status"] = "completed"
        await asyncio.to_thread(save_progress, submission_id, progress)
    except Exception as e:
        progress["status"] = "failed"
        await asyncio.to_thread(save_progress, submission_id, progress)
        raise HTTPException(
            status_code=500, detail=f"Error processing AI responses: {e}"
        )

    # Merge parts into the final result schema
    final_result = {
        "title": overview.get("title", ""),
        "markdown": overview.get("markdown", ""),
        "keyInsights": key_insights,
        "tabs": tabs,
    }

    # Save final result for external reference (as processed result)
    final_result_path = os.path.join(PROCESSED_DIR, f"{submission_id}_result.json")
    await asyncio.to_thread(
        lambda: open(final_result_path, "w").write(json.dumps(final_result, indent=2))
    )

    # Also, save the dashboard result for retrieval by the dashboards endpoint
    dashboard_path = os.path.join(AI_CACHED_DIR, f"{submission_id}_dashboard.json")
    await asyncio.to_thread(
        lambda: open(dashboard_path, "w").write(json.dumps(final_result, indent=2))
    )

    return final_result


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
