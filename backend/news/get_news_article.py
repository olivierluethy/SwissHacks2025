"""
Function that, given a filename of a news article, returns its text content.
"""

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from pathlib import Path

app = FastAPI()

NEWS_FOLDER = Path("../data/raw/news")  # Path to the folder containing news articles. The originals are md so we can use them as is, no need to process them.

@app.get("/get-news", response_class=PlainTextResponse)
def get_news_file(filename: str):
    file_path = NEWS_FOLDER / filename

    if not file_path.exists() or not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found.")

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
        return content
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")



# Example usage, will only be run if this script is executed directly (not when imported)
if __name__ == "__main__":
    text = get_news_file("article_653771_2022_02_11.md")  # First article in the news folder
    print(text)