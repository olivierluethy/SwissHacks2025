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




# # Combines the two endpoints above to return the contents of the top K related files
# @router.post("/top_k_related_files_contents", response_model=List[RelatedFile])
# def get_top_k_related_files_contents(request: InputTextRequest):
#     # Get the top K related files
#     related_files = get_top_k_related_files(request)

#     # Get the contents of each related file
#     for related_file in related_files:
#         filename = related_file.filename
#         try:
#             with open(BASE_FOLDER / filename, "r", encoding="utf-8") as f:
#                 content = f.read()
#             related_file.content = content
#         except Exception as e:
#             raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

#     return related_files


@router.post("/get_combined_file_contents", response_class=PlainTextResponse)
async def get_combined_file_contents(request: InputTextRequest):
    input_text = request.input_text
    k = request.k

    # Load embeddings
    if not os.path.exists(EMBEDDINGS_FILE):
        raise HTTPException(status_code=404, detail=f"Embeddings file '{EMBEDDINGS_FILE}' not found.")

    with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
        embeddings_dict = json.load(f)

    if not embeddings_dict:
        raise HTTPException(status_code=400, detail="Embeddings data is empty.")

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
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                combined_content += f"\n--- {filename} ---\n"
                combined_content += f.read()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading file '{filename}': {str(e)}")

    return combined_content.strip()