"""
Given a text input, return the filepaths of the top K most similar files,
based on previously computed embeddings stored in a json file.
"""

import os
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from typing import List
from pydantic import BaseModel
from fastapi.responses import PlainTextResponse
from pathlib import Path
from fastapi import APIRouter, HTTPException


MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDINGS_FILE = "data/embeddings.json"  # Json containing pre-computed embeddings as 'filename:vector' pairs


router = APIRouter()


class RelatedFile(BaseModel):
    filename: str
    confidence: float

class InputTextRequest(BaseModel):
    input_text: str
    k: int = 5

@router.post("/top_k_related_files", response_model=List[RelatedFile])
async def get_top_k_related_files(request: InputTextRequest):
    input_text = request.input_text
    k = request.k

    # Load Model and Data
    model = SentenceTransformer(MODEL_NAME)

    if not os.path.exists(EMBEDDINGS_FILE):
        raise HTTPException(status_code=404, detail=f"Embeddings file '{EMBEDDINGS_FILE}' not found.")

    with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
        embeddings_dict = json.load(f)

    if not embeddings_dict:
        raise HTTPException(status_code=400, detail="Embeddings data is empty.")

    file_names = list(embeddings_dict.keys())
    embedding_matrix = np.array([embeddings_dict[name] for name in file_names])

    input_embedding = model.encode(input_text.strip()).reshape(1, -1)

    similarities = cosine_similarity(input_embedding, embedding_matrix)[0]

    top_indices = similarities.argsort()[::-1][:k]

    results = [
        RelatedFile(filename=file_names[idx], confidence=float(similarities[idx]))
        for idx in top_indices
    ]

    return results




BASE_FOLDER = Path(r"data/aux_data_processed")

@router.get("/get-file-contents", response_class=PlainTextResponse)
async def get_file_contents(filename: str):
    """ Function that, given a filepath, returns its text content """
    file_path = BASE_FOLDER / filename
    print(file_path)

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")



# Combines both previous endpoints: given a text input, return the concatenated contents of the top K most
# semantically similar files. The resulting string includes a header with the filename of each file used,
# and also linebreaks between the contents of each file.
def get_top_k_related_files_contents(input_text: str, k: int = 5) -> str:
    # Load embeddings
    if not os.path.exists(EMBEDDINGS_FILE):
        raise FileNotFoundError(f"Embeddings file '{EMBEDDINGS_FILE}' not found.")

    with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
        embeddings_dict = json.load(f)

    if not embeddings_dict:
        raise ValueError("Embeddings data is empty.")

    # Load model and compute similarity
    model = SentenceTransformer(MODEL_NAME)
    input_embedding = model.encode(input_text.strip()).reshape(1, -1)

    file_names = list(embeddings_dict.keys())
    embedding_matrix = np.array([embeddings_dict[name] for name in file_names])
    similarities = cosine_similarity(input_embedding, embedding_matrix)[0]

    top_indices = similarities.argsort()[::-1][:k]
    top_filenames = [file_names[idx] for idx in top_indices]

    # Read and concatenate file contents
    combined_content = ""
    for filename in top_filenames:
        file_path = BASE_FOLDER / filename
        if not file_path.exists() or not file_path.is_file():
            raise FileNotFoundError(f"File not found: {filename}")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                combined_content += f"\n\n--------------------------\n--- {filename} ---\n"
                combined_content += f.read()
        except Exception as e:
            raise IOError(f"Error reading file '{filename}': {str(e)}")
    combined_content += "\n\n-------- End of context -----------\n"

    return combined_content.strip()

# API endpoint of the previous function
@router.post("/top_k_related_files_contents", response_class=PlainTextResponse)
async def get_top_k_related_files_contents_endpoint(request: InputTextRequest):
    try:
        return get_top_k_related_files_contents(request.input_text, request.k)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except IOError as e:
        raise HTTPException(status_code=500, detail=str(e))