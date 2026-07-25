"""Centralised settings.

IMP-016: paths used to be resolved against the current working directory, so the
server only ran when launched from `backend/`, and the port was hardcoded.
Everything here is anchored to this file's location and overridable by env var.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _path(env: str, default: str) -> Path:
    value = os.environ.get(env)
    return Path(value).resolve() if value else (BASE_DIR / default)


def _int(env: str, default: int) -> int:
    try:
        return int(os.environ.get(env, default))
    except ValueError:
        return default


def _float(env: str, default: float) -> float:
    try:
        return float(os.environ.get(env, default))
    except ValueError:
        return default


# --- Model -----------------------------------------------------------------
# Default left as o3-mini so analysis quality does not change silently. Use
# scripts/benchmark_models.py to pick a faster one for your data, then set
# OPENAI_MODEL. The per-file summary step is new, so it defaults to a cheap
# model - it is extraction, not reasoning.
MODEL_NAME = os.environ.get("OPENAI_MODEL", "o3-mini")
SUMMARY_MODEL_NAME = os.environ.get("OPENAI_SUMMARY_MODEL", "gpt-4o-mini")

# IMP-005: the SDK defaults are a 600 s read timeout and 2 retries, so a single
# stuck call could hold a job for 30 minutes with no user-visible signal.
OPENAI_TIMEOUT_SECONDS = _float("OPENAI_TIMEOUT_SECONDS", 120.0)
OPENAI_MAX_RETRIES = _int("OPENAI_MAX_RETRIES", 2)
MAX_COMPLETION_TOKENS = _int("OPENAI_MAX_COMPLETION_TOKENS", 8000)
# Only sent for reasoning models (o*/gpt-5 families).
REASONING_EFFORT = os.environ.get("OPENAI_REASONING_EFFORT", "medium")

# --- Retrieval -------------------------------------------------------------
EMBEDDING_MODEL_NAME = os.environ.get("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
# BUG-004: all-MiniLM-L6-v2 truncates at 256 word pieces. Chunks must stay under
# that or the tail of every chunk is silently discarded.
CHUNK_TOKENS = _int("CHUNK_TOKENS", 200)
CHUNK_OVERLAP_TOKENS = _int("CHUNK_OVERLAP_TOKENS", 40)
RETRIEVAL_TOP_K = _int("RETRIEVAL_TOP_K", 8)
# How many query chunks to sample from a submission when retrieving.
QUERY_CHUNK_LIMIT = _int("QUERY_CHUNK_LIMIT", 32)

# --- Pipeline --------------------------------------------------------------
MAX_CONCURRENT_LLM_CALLS = _int("MAX_CONCURRENT_LLM_CALLS", 6)
# Tokens per slice when a single source file is too large to summarise in one go.
SUMMARY_SLICE_TOKENS = _int("SUMMARY_SLICE_TOKENS", 12000)
JOB_STALE_SECONDS = _int("JOB_STALE_SECONDS", 1800)

# --- Paths -----------------------------------------------------------------
UPLOAD_DIR = _path("UPLOAD_DIR", "uploads")
PROCESSING_DIR = _path("PROCESSING_DIR", "processing")
PROCESSED_DIR = _path("PROCESSED_DIR", "processed")
ANALYSIS_DIR = _path("ANALYSIS_DIR", "analysis")
DATA_DIR = _path("DATA_DIR", "data")
AI_CACHED_DIR = _path("AI_CACHED_DIR", "data/ai_cached")
LLM_CACHE_DIR = _path("LLM_CACHE_DIR", "data/llm_cache")
PROGRESS_DIR = _path("PROGRESS_DIR", "data/progress")
SUBMISSIONS_DIR = _path("SUBMISSIONS_DIR", "data/submissions_processed")
FEEDBACK_DIR = _path("FEEDBACK_DIR", "data/feedback")
AUX_DATA_DIR = _path("AUX_DATA_DIR", "data/aux_data_processed")
INDEX_DIR = _path("INDEX_DIR", "data/index")
JOBS_DB = _path("JOBS_DB", "data/jobs.sqlite3")
FONTS_DIR = _path("FONTS_DIR", "fonts")

RUNTIME_DIRS = [
    UPLOAD_DIR,
    PROCESSING_DIR,
    PROCESSED_DIR,
    ANALYSIS_DIR,
    AI_CACHED_DIR,
    LLM_CACHE_DIR,
    PROGRESS_DIR,
    SUBMISSIONS_DIR,
    FEEDBACK_DIR,
    INDEX_DIR,
]


def ensure_runtime_dirs() -> None:
    for folder in RUNTIME_DIRS:
        folder.mkdir(parents=True, exist_ok=True)


# --- Server ----------------------------------------------------------------
HOST = os.environ.get("HOST", "0.0.0.0")
PORT = _int("PORT", 8000)
CORS_ALLOW_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOW_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

# --- Auth (SEC-002) --------------------------------------------------------
# When unset, the API is open - which is the current behaviour and fine for a
# local single-user run. Set it for anything reachable by others.
API_TOKEN = os.environ.get("API_TOKEN") or None
