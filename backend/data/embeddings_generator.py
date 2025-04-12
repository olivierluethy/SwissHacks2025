"""
Use this script to create embeddings of all markdown files in a specified folder.
It will save the embeddings in a JSON file. If the script is run again, it will skip files that have already been embedded.
Warning: if you manually cancel the script, you will not lose the progress [EDIT: YOU WILL], but it may leave the JSON file in an incomplete state.
         Repair it by deleting the last embedding and adding a closing "}" before rerunning the script.
"""

import os
import json
from sentence_transformers import SentenceTransformer
from colorama import Fore

# Set folder path and output JSON filename
FOLDER_PATH = r"aux_data_processed" # Path to the folder containing the files to be embedded (relative to the location in which this script is run)
OUTPUT_FILE = "embeddings.json"
MODEL_NAME = "all-MiniLM-L6-v2"
ALLOWED_EXTENSIONS = (".md", ".csv", ".txt")  # Allowed file extensions (as tuple for endswith)

count = 0

# Load or initialize JSON data (so that we can skip already processed files)
if os.path.exists(OUTPUT_FILE):
    with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
        embeddings_dict = json.load(f)
else:
    embeddings_dict = {}

# Load model
model = SentenceTransformer(MODEL_NAME)

walk_path = os.path.join(os.path.dirname(__file__), FOLDER_PATH)
print(walk_path)

# Recursively walk through all files in the directory tree
for root, dirs, files in os.walk(walk_path):
    for file in files:
        count += 1

        if not file.lower().endswith(ALLOWED_EXTENSIONS):
            print(f"{count}: Skipping {relative_path} (invalid file type)")
            continue

        file_path = os.path.join(root, file)
        relative_path = os.path.relpath(file_path, FOLDER_PATH)

        if relative_path in embeddings_dict:
            print(f"{count}: Skipping {relative_path} (already embedded)")
            continue

        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()

        if not content:
            print(f"{count}: Skipping {relative_path} (empty file)")
            continue

        # Append the file path & name to the content
        content = f"File: {relative_path}\nContent:\n{content}"""
        # print(content)

        print(f"{count}: Embedding {relative_path}...")
        print(Fore.LIGHTBLACK_EX)
        embedding = model.encode(content).tolist()
        print(Fore.RESET)
        embeddings_dict[relative_path] = embedding

    # Save json
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(embeddings_dict, f, indent=2)


print(f"Embeddings saved to {OUTPUT_FILE}")
