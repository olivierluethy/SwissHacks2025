import os
import json
import re
import hashlib
import asyncio
from threading import Lock

from fastapi import FastAPI, HTTPException, Path, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from openai import OpenAI

# For RAG (retrieval augmented generation)
from data import data_endpoints
from data.data_endpoints import get_top_k_related_files_contents

# Set your OpenAI API key (ensure this key is available in your environment)
client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL_NAME = "o3-mini"  # Or "gpt-4" if desired

app = FastAPI(title="Async File Processing API with AI Caching, Feedback & Progress")
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

# Lock for file writes
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


# -----------------------------
# Serve Static Files for Processed Results and Dashboards
# -----------------------------
app.mount("/results", StaticFiles(directory=PROCESSED_DIR), name="results")

# Endpoints declared in other files (RAG functionality)
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


@app.post("/dashboards/{dashboard_id}/feedback")
async def submit_feedback(dashboard_id: str = Path(...), feedback: dict = Body(...)):
    # For a real application, you would persist the feedback.
    print(f"Feedback for {dashboard_id}: {feedback}")
    return {"status": "success", "message": "Feedback submitted successfully."}


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
    Check for a cached AI response. If none exists, call the AI API,
    cache and return the result.
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
        # Remove any embedded <think> sections if present.
        cleaned_content = re.sub(
            r"<think>.*?</think>\s*", "", content, flags=re.DOTALL
        ).strip()
        with open(cache_file, "w") as f:
            json.dump({"response": cleaned_content}, f, indent=2)
        return cleaned_content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error querying the AI: {e}")


# -----------------------------
# Revised AI Query Functions
# -----------------------------
def generate_overview(markdown_text: str, submission_id: str, context: str) -> str:
    prompt = f"""
You are an expert AI assistant for underwriters. Given the real data provided below, generate an analysis overview that highlights only the most critical and non-obvious risk indicators and key findings. Avoid reiterating common or trivial information. Emphasize aspects of the data that an underwriter must know for decision making.

Follow the JSON schema exactly.

JSON Schema:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "AI Overview Schema",
  "type": "object",
  "required": ["title", "markdown"],
  "properties": {{
    "title": {{"type": "string", "description": "The main title of the analysis report"}},
    "markdown": {{"type": "string", "description": "Markdown-formatted summary focusing on critical non-obvious insights"}}
  }}
}}

Context:
{context}

Markdown input to analyze:
{markdown_text}

Output only valid JSON following the schema.
"""
    return cached_ai_query(prompt, "overview", submission_id)


def generate_key_insights(markdown_text: str, submission_id: str, context: str) -> str:
    prompt = f"""
You are an expert in data analysis for underwriting. Analyze the real input data and extract only the most significant, non-obvious insights that affect risk or performance. Avoid repeating common observations; instead, focus on critical trends, anomalies, or risks an underwriter must evaluate.

Follow the JSON schema exactly.

JSON Schema:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Key Insights Schema",
  "type": "array",
  "description": "A list of important insights derived from the data analysis",
  "items": {{
    "type": "object",
    "required": ["title", "description", "impact", "confidence"],
    "properties": {{
      "title": {{"type": "string", "description": "Insight headline"}},
      "description": {{"type": "string", "description": "Detailed explanation emphasizing non-obvious critical data points"}},
      "impact": {{"type": "string", "enum": ["positive", "negative"], "description": "Overall effect on risk/performance"}},
      "confidence": {{"type": "number", "minimum": 0, "maximum": 1, "description": "Reliability score"}}
    }}
  }}
}}

Context:
{context}

Markdown input to analyze:
{markdown_text}

Return only valid JSON strictly adhering to the schema.
"""
    return cached_ai_query(prompt, "key_insights", submission_id)


def generate_tabs(markdown_text: str, submission_id: str, context: str) -> str:
    prompt = f"""
You are an expert data analyst for underwriting reports. Based on the provided data, generate a collection of dashboard tabs that highlight advanced visualizations and analysis. Ensure the output focuses on the most critical data points required for underwriting and avoids stating the obvious.

Follow the JSON schema exactly.

JSON Schema:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Tabs Schema",
  "type": "array",
  "description": "Dashboard tabs representing major analytical focus areas",
  "items": {{
    "type": "object",
    "required": ["id", "title", "content"],
    "properties": {{
      "id": {{"type": "string", "description": "Unique tab identifier"}},
      "title": {{"type": "string", "description": "Tab title for the UI"}},
      "content": {{
        "type": "object",
        "required": ["type", "data"],
        "properties": {{
          "type": {{"type": "string", "enum": ["json", "html"], "description": "Format of the content"}},
          "data": {{
            "description": "Content details which could be a JSON chart or HTML summary",
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
                        "value": {{"type": "number", "description": "Numerical value"}}
                      }},
                      "required": ["value"],
                      "minProperties": 2
                    }}
                  }}
                }}
              }},
              {{
                "type": "string",
                "description": "HTML formatted content"
              }}
            ]
          }}
        }}
      }}
    }}
  }}
}}

Context:
{context}

Markdown input to analyze:
{markdown_text}

Return only valid JSON following the schema.
"""
    return cached_ai_query(prompt, "tabs", submission_id)


# -----------------------------
# Utility: File Reading and JSON Parsing
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
                    combined_text += f.read() + "\n\n"
            except Exception as e:
                raise Exception(f"Error reading file {file_path}: {e}")
    return combined_text.strip()


def clean_and_parse_json(text: str):
    """
    Cleans text by removing markdown code fences and fixing common JSON issues,
    then attempts to parse the result.
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
    # Initialize progress
    progress = await asyncio.to_thread(load_progress, submission_id)
    progress.update({"status": "in_progress", "progress": 0, "results": {}})
    await asyncio.to_thread(save_progress, submission_id, progress)

    submission_folder = os.path.join(SUBMISSIONS_DIR, submission_id)
    if not os.path.exists(submission_folder):
        raise HTTPException(status_code=404, detail="Submission folder not found")

    try:
        # Read all files and generate context using RAG helper.
        markdown_text = await asyncio.to_thread(
            read_all_files_from_folder, submission_folder
        )
        context = get_top_k_related_files_contents(markdown_text, k=10)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        # Generate Overview (33% progress)
        overview_json_str = await asyncio.to_thread(
            generate_overview, markdown_text, submission_id, context
        )
        print("Overview JSON:", overview_json_str)
        overview = await asyncio.to_thread(clean_and_parse_json, overview_json_str)
        progress["results"]["overview"] = overview
        progress["progress"] = 33
        await asyncio.to_thread(save_progress, submission_id, progress)

        # Generate Key Insights (66% progress)
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

        # Generate Tabs (100% progress)
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

    # Merge into final result
    final_result = {
        "title": overview.get("title", ""),
        "markdown": overview.get("markdown", ""),
        "keyInsights": key_insights,
        "tabs": tabs,
    }

    # Save final result to processed directory and as a dashboard
    final_result_path = os.path.join(PROCESSED_DIR, f"{submission_id}_result.json")
    await asyncio.to_thread(
        lambda: open(final_result_path, "w").write(json.dumps(final_result, indent=2))
    )
    dashboard_path = os.path.join(AI_CACHED_DIR, f"{submission_id}_dashboard.json")
    await asyncio.to_thread(
        lambda: open(dashboard_path, "w").write(json.dumps(final_result, indent=2))
    )

    return final_result


# -----------------------------
# AI Response to Feedback Endpoint
# -----------------------------


def generate_feedback_response(
    feedback: dict, current_dashboard: dict, context: str, markdown_text: str
) -> str:
    """
    Given the user feedback, the current dashboard content, the submission context,
    and the original markdown data, generate a revised dashboard update.
    The AI should update only the fields targeted by the feedback while leaving
    unrelated fields unchanged. The output must strictly follow the provided JSON schema.
    """
    prompt = f"""
You are an expert AI assistant specialized in generating underwriting reports. Your task is to update only the parts of the dashboard that are directly related to the user feedback while leaving all other sections completely unchanged.

Please follow these instructions precisely:
1. Output a complete and valid JSON document that follows the original dashboard schema.
2. Only modify the specific section identified by the feedback's 'contentId' and 'contentType'; do not alter any sections not mentioned in the feedback.
3. Preserve any content that is unrelated to the feedback.
4. For the updated section, incorporate the feedback in a way that is data-grounded and reflects only non-trivial improvements.
5. Do not reiterate or modify any information that is already correct and does not conflict with the feedback.
6. Ensure that the modifications are consistent with underwriting principles and highlight only critical insights.
7. Use concise, precise language that eliminates redundant or obvious details.
8. Ensure that any statistical or numeric data present remains unchanged unless it is explicitly targeted in the feedback.
9. Provide a clear and improved version of the targeted section that reflects the user's suggestions while keeping all other sections intact.
10. Do not provide any explanations or commentary; output only the updated JSON.
11. Double-check that the final output meets all the JSON schema requirements as defined in the original dashboard.

Current Dashboard:
{json.dumps(current_dashboard, indent=2)}

Submission Context:
{context}

Original Markdown Data:
{markdown_text}

User Feedback:
{json.dumps(feedback, indent=2)}

Task:
Based on the above information, update only the relevant parts of the dashboard content according to the feedback. Do not modify any data that is not impacted by the feedback. Focus on the critical, non-obvious data points that an underwriter must know, and avoid reiterating trivial or obvious information.
Follow the JSON schema exactly.

JSON Schema:
{{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Updated Dashboard Schema",
  "type": "object",
  "required": ["title", "markdown", "keyInsights", "tabs"],
  "properties": {{
    "title": {{"type": "string", "description": "The main title of the analysis report"}},
    "markdown": {{"type": "string", "description": "Markdown-formatted summary focusing on critical non-obvious insights"}},
    "keyInsights": {{
      "type": "array",
      "description": "A list of important insights derived from the data analysis",
      "items": {{
        "type": "object",
        "required": ["title", "description", "impact", "confidence"],
        "properties": {{
          "title": {{"type": "string", "description": "Insight headline"}},
          "description": {{"type": "string", "description": "Detailed explanation emphasizing non-obvious critical data points"}},
          "impact": {{"type": "string", "enum": ["positive", "negative"], "description": "Overall effect on risk/performance"}},
          "confidence": {{"type": "number", "minimum": 0, "maximum": 1, "description": "Reliability score"}}
        }}
      }}
    }},
    "tabs": {{
      "type": "array",
      "description": "Dashboard tabs representing major analytical focus areas",
      "items": {{
        "type": "object",
        "required": ["id", "title", "content"],
        "properties": {{
          "id": {{"type": "string", "description": "Unique tab identifier"}},
          "title": {{"type": "string", "description": "Tab title for the UI"}},
          "content": {{
            "type": "object",
            "required": ["type", "data"],
            "properties": {{
              "type": {{"type": "string", "enum": ["json", "html"], "description": "Format of the content"}},
              "data": {{
                "description": "Content details which could be a JSON chart or HTML summary",
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
                            "value": {{"type": "number", "description": "Numerical value"}}
                          }},
                          "required": ["value"],
                          "minProperties": 2
                        }}
                      }}
                    }}
                  }},
                  {{
                    "type": "string",
                    "description": "HTML formatted content"
                  }}
                ]
              }}
            }}
          }}
        }}
      }}
    }}
  }}
}}

Output a complete updated dashboard in valid JSON, strictly following the schema, while only changing the fields that are impacted by the feedback.
"""
    return cached_ai_query(
        prompt, "feedback_response", current_dashboard.get("title", "feedback")
    )


@app.post("/dashboards/{dashboard_id}/ai-response")
async def get_ai_response_to_feedback(
    dashboard_id: str = Path(...), feedback: dict = Body(...)
):
    # Load the current dashboard.
    dashboard_path = os.path.join(AI_CACHED_DIR, f"{dashboard_id}.json")
    if not os.path.exists(dashboard_path):
        raise HTTPException(status_code=404, detail="Dashboard not found")
    with open(dashboard_path, "r") as f:
        current_dashboard = json.load(f)

    # Load the context and original markdown data.
    submission_id = dashboard_id.split("_")[0]
    submission_folder = os.path.join(SUBMISSIONS_DIR, submission_id)
    if not os.path.exists(submission_folder):
        raise HTTPException(status_code=404, detail="Submission folder not found")
    markdown_text = await asyncio.to_thread(
        read_all_files_from_folder, submission_folder
    )
    context = get_top_k_related_files_contents(markdown_text, k=10)
    if not context:
        raise HTTPException(status_code=404, detail="Context not found")

    try:
        updated_response_str = await asyncio.to_thread(
            generate_feedback_response,
            feedback,
            current_dashboard.copy(),
            context,
            markdown_text,
        )
        updated_dashboard = await asyncio.to_thread(
            clean_and_parse_json, updated_response_str
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing AI feedback: {e}"
        )

    # Save updated dashboard for future retrieval.
    await asyncio.to_thread(
        lambda: open(dashboard_path, "w").write(json.dumps(updated_dashboard, indent=2))
    )
    # Optionally, update the processed result file as well.
    processed_result_path = os.path.join(PROCESSED_DIR, f"{dashboard_id}_result.json")
    await asyncio.to_thread(
        lambda: open(processed_result_path, "w").write(
            json.dumps(updated_dashboard, indent=2)
        )
    )

    return updated_dashboard


# -----------------------------
# Main Execution
# -----------------------------
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
