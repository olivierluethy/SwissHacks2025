"""
Given a text input, return the filepaths of the top K most similar files,
based on previously computed embeddings stored in a json file.
"""

import logging
import os
import json
import threading
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Optional, Tuple
from pydantic import BaseModel
from fastapi.responses import PlainTextResponse
from pathlib import Path
from fastapi import APIRouter, HTTPException


MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDINGS_FILE = "data/embeddings.json"  # Json containing pre-computed embeddings as 'filename:vector' pairs

logger = logging.getLogger("archre.retrieval")

router = APIRouter()

BASE_FOLDER = Path(r"data/aux_data_processed")


# ---------------------------------------------------------------------------
# IMP-002: load the model and the embedding index ONCE.
#
# Both used to be rebuilt on every single call: json.load of a 50 MB file
# (measured 0.577 s) plus SentenceTransformer construction (measured 2.613 s)
# = 3.19 s of pure overhead per retrieval, and the chat path pays it twice.
# ---------------------------------------------------------------------------
_model: Optional[SentenceTransformer] = None
_model_lock = threading.Lock()

_index: Optional[Tuple[List[str], np.ndarray]] = None
_index_lock = threading.Lock()


def get_model() -> SentenceTransformer:
    """Process-wide singleton SentenceTransformer."""
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                logger.info("retrieval.model_load model=%s", MODEL_NAME)
                _model = SentenceTransformer(MODEL_NAME)
    return _model


def get_index() -> Tuple[List[str], np.ndarray]:
    """Process-wide singleton (filenames, embedding_matrix).

    The matrix is L2-normalised once at load time so similarity is a plain dot
    product rather than a full cosine_similarity call per query.
    """
    global _index
    if _index is None:
        with _index_lock:
            if _index is None:
                if not os.path.exists(EMBEDDINGS_FILE):
                    raise FileNotFoundError(
                        f"Embeddings file '{EMBEDDINGS_FILE}' not found."
                    )
                with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
                    embeddings_dict = json.load(f)
                if not embeddings_dict:
                    raise ValueError("Embeddings data is empty.")

                file_names = list(embeddings_dict.keys())
                matrix = np.asarray(
                    [embeddings_dict[name] for name in file_names], dtype=np.float32
                )
                norms = np.linalg.norm(matrix, axis=1, keepdims=True)
                norms[norms == 0] = 1.0
                matrix = matrix / norms
                logger.info(
                    "retrieval.index_load vectors=%d dim=%d", *matrix.shape
                )
                _index = (file_names, matrix)
    return _index


def warmup() -> None:
    """Eagerly build both singletons (called from the app's startup hook)."""
    get_model()
    get_index()


def resolve_within_base(filename: str) -> Path:
    """Resolve `filename` under BASE_FOLDER, refusing anything that escapes it.

    SEC-001: `BASE_FOLDER / filename` allowed arbitrary file reads -
    `?filename=../../../../../../../etc/passwd` returned /etc/passwd on an
    unauthenticated endpoint.
    """
    base = BASE_FOLDER.resolve()
    candidate = (base / filename).resolve()
    if not candidate.is_relative_to(base):
        raise HTTPException(status_code=404, detail="File not found.")
    return candidate


def _top_k(input_text: str, k: int) -> List[Tuple[str, float]]:
    file_names, matrix = get_index()
    model = get_model()

    query = model.encode(input_text.strip())
    query = np.asarray(query, dtype=np.float32)
    norm = np.linalg.norm(query)
    if norm:
        query = query / norm

    similarities = matrix @ query
    k = max(1, min(int(k), len(file_names)))
    top_indices = np.argpartition(-similarities, k - 1)[:k]
    top_indices = top_indices[np.argsort(-similarities[top_indices])]
    return [(file_names[i], float(similarities[i])) for i in top_indices]


class RelatedFile(BaseModel):
    filename: str
    confidence: float


class InputTextRequest(BaseModel):
    input_text: str
    k: int = 5


@router.post("/top_k_related_files", response_model=List[RelatedFile])
def get_top_k_related_files(request: InputTextRequest):
    try:
        results = _top_k(request.input_text, request.k)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return [
        RelatedFile(filename=name, confidence=score) for name, score in results
    ]


@router.get("/get-file-contents", response_class=PlainTextResponse)
def get_file_contents(filename: str):
    """Function that, given a filepath, returns its text content."""
    file_path = resolve_within_base(filename)

    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        return file_path.read_text(encoding="utf-8")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")


# Combines both previous endpoints: given a text input, return the concatenated contents of the top K most
# semantically similar files. The resulting string includes a header with the filename of each file used,
# and also linebreaks between the contents of each file.
def get_top_k_related_files_contents(input_text: str, k: int = 5) -> str:
    results = _top_k(input_text, k)

    combined_content = ""
    for filename, _score in results:
        file_path = resolve_within_base(filename.replace("\\", "/"))
        if not file_path.is_file():
            raise FileNotFoundError(f"File not found: {file_path}")
        combined_content += f"\n\n--------------------------\n--- {filename} ---\n"
        combined_content += file_path.read_text(encoding="utf-8")
    combined_content += "\n\n-------- End of context -----------\n"

    return combined_content.strip()


# API endpoint of the previous function
@router.post("/top_k_related_files_contents", response_class=PlainTextResponse)
def get_top_k_related_files_contents_endpoint(request: InputTextRequest):
    try:
        return get_top_k_related_files_contents(request.input_text, request.k)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IOError as e:
        raise HTTPException(status_code=500, detail=str(e))
