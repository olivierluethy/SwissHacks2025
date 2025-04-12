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

# Example usage, will only be run if this script is executed directly (not when imported as a module)
# if __name__ == "__main__":
#     # Example usage
#     input_text = "Do white collar workers need to be in the office?"    # Example input text, should correlate strongly with 'article_654074_2022_02_15.md'
#     top_k_articles = find_top_k_related_articles(input_text, k=5)
#     print(top_k_articles)




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



# Example usage, will only be run if this script is executed directly (not when imported)
# Run it from the the same working directory as the backend will call it from (i.e. /backend)
# if __name__ == "__main__":
#     text = get_news_file("article_653771_2022_02_11.md")  # First article in the news folder
#     print(text)