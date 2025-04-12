"""
Given a text input, return the filenames of the top K most similar news articles,
based on previously computed embeddings stored in a json file.
"""

import os
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


MODEL_NAME = "all-MiniLM-L6-v2"
EMBEDDINGS_FILE = "embeddings.json"  # Json containing pre-computed embeddings as 'filename:vector' pairs


def find_top_k_related_articles(input_text, k=5):

    # Load Model and Data
    model = SentenceTransformer(MODEL_NAME)

    # Ensure embeddings file exists
    if not os.path.exists(EMBEDDINGS_FILE):
        raise FileNotFoundError(f"Embeddings file '{EMBEDDINGS_FILE}' not found. Please ensure it exists and is accessible.")

    with open(EMBEDDINGS_FILE, "r", encoding="utf-8") as f:
        embeddings_dict = json.load(f)

    # Create numpy arrays for similarity comparison
    file_names = list(embeddings_dict.keys())
    embedding_matrix = np.array([embeddings_dict[name] for name in file_names])

    # Input Text
    input_text = input_text.strip()
    input_embedding = model.encode(input_text).reshape(1, -1)

    # Compute Cosine Similarities
    similarities = cosine_similarity(input_embedding, embedding_matrix)[0]

    # Order by similarity, and slice to get only top k elementes
    top_indices = similarities.argsort()[::-1][:k]

    # Print results
    print(f"\nTop related markdown files:")
    for idx in top_indices:
        print(f"{file_names[idx]} (score: {similarities[idx]:.4f})")

    # Prepare results as JSON (with filenames and confidence scores)
    results = [
        {"filename": file_names[idx], "confidence": float(similarities[idx])}
        for idx in top_indices
    ]

    return results


# Example usage, will only be run if this script is executed directly (not when imported as a module)
if __name__ == "__main__":
    # Example usage
    input_text = "Do white collar workers need to be in the office?"    # Example input text, should correlate strongly with 'article_654074_2022_02_15.md'
    top_k_articles = find_top_k_related_articles(input_text, k=5)
    print(top_k_articles)


