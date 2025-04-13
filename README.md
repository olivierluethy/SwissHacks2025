# SwissHacks2025
Official repo of Arch Re project

How to use and deploy the FastAPI-based Excel Subtable Extractor API, as well as how it works under the hood. It’s concise, clear, and includes all necessary details for setup, usage, and functionality.

---

# Excel Subtable Extractor API

This FastAPI application extracts subtables from Excel (`.xlsx`) files and returns them in Markdown or HTML format. It uses a smart breadth-first search (BFS) algorithm to detect tables, handling merged cells, titles, and footers intelligently.


# Getting started (backend & frontend)
cd backend
pip install -r requirements.txt # Install requirements. Recommended to do it in a venv
python main.py
--------------
cd frontend
npm i
npm run dev


## Table of Contents
- [Features](#features)
- [How It Works](#how-it-works)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running the API](#running-the-api)
- [Using the API](#using-the-api)
  - [Endpoint Details](#endpoint-details)
  - [Examples](#examples)
- [Error Handling](#error-handling)
- [Contributing](#contributing)

## Features
- **File Upload**: Accepts `.xlsx` files via a POST request.
- **Output Formats**: Returns extracted subtables as Markdown (`md`) or HTML (`html`).
- **Smart Table Detection**: Identifies subtables using BFS, considering merged cells, headers, titles, and footers.
- **Merged Cell Support**: Properly handles Excel merged cells in output tables.
- **Interactive Docs**: Includes Swagger UI for easy testing at `/docs`.

## How It Works
The API processes Excel files as follows:
1. **File Parsing**: Reads the uploaded `.xlsx` file using `openpyxl`, loading it into memory as a workbook.
2. **Sheet Processing**:
   - Converts each sheet into a 2D matrix of cell data (value and fill color).
   - Identifies merged cells and propagates their values to all cells in the merged region.
3. **Table Detection**:
   - Uses a BFS algorithm to find connected components of non-empty cells.
   - Allows small gaps (up to 2 rows vertically, 1 column horizontally) to connect related cells.
   - Prioritizes larger tables and avoids overlaps.
   - Detects titles based on merged cells or header-like formatting.
4. **Output Formatting**:
   - Extracts titles and table bounds for each detected subtable.
   - Converts subtables to Markdown or HTML, preserving merged cell structure (via `rowspan`/`colspan` in HTML).
   - Markdown tables use escaped pipes (`\|`) and aligned columns.
5. **Response**: Returns formatted output per sheet, with titles and separators.

## Requirements
- Python 3.8+
- Packages:
  - `fastapi`
  - `uvicorn`
  - `openpyxl`

## Installation
1. **Clone the Repository**:
   ```bash
   git clone <repository-url>
   cd excel-subtable-extractor
   ```

2. **Set Up a Virtual Environment** (optional but recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install fastapi uvicorn openpyxl
   ```

## Running the API
1. **Save the Code**: Ensure the main application is in a file, e.g., `app.py`.
2. **Start the Server**:
   ```bash
   uvicorn app:app --host 0.0.0.0 --port 8000
   ```
   - Runs at `http://localhost:8000`.
   - Use `--host 0.0.0.0` for external access (e.g., network testing).
   - Access Swagger UI at `http://localhost:8000/docs` for interactive testing.

3. **Stop the Server**: Press `Ctrl+C` in the terminal.

## Using the API

### Endpoint Details
- **URL**: `POST /extract`
- **Parameters**:
  - `file`: (Required) An `.xlsx` file uploaded as form-data.
  - `output_format`: (Optional) Query parameter (`html` or `md`). Default: `html`.
- **Response**:
  - `text/markdown` for `output_format=md`.
  - `text/html` for `output_format=html`.
- **Example Output (Markdown)**:
  ```markdown
  # Extracted Excel Subtables

  ## Sheet: Sheet1

  ### Sales Data
  | Product | Price |
  |---------|-------|
  | Apple   | $1.00 |
  | Banana  | $0.50 |

  ---

  ### Summary
  | Total | $1.50 |
  |-------|-------|
  ```

### Examples

#### Using `curl`
Upload an Excel file and get Markdown output:
```bash
curl -X POST "http://localhost:8000/extract?output_format=md" \
     -F "file=@/path/to/your/file.xlsx" \
     -o output.md
```
- Saves the Markdown to `output.md`.

#### Using Python (`requests`)
```python
import requests

url = "http://localhost:8000/extract?output_format=md"
file_path = "test.xlsx"

with open(file_path, "rb") as f:
    files = {"file": ("test.xlsx", f, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    response = requests.post(url, files=files)

if response.status_code == 200:
    with open("output.md", "w", encoding="utf-8") as f:
        f.write(response.text)
    print("Saved to output.md")
else:
    print(f"Error: {response.status_code} - {response.json()['detail']}")
```
- Install `requests`: `pip install requests`.
- Replace `test.xlsx` with your file path.

#### Using Postman
1. Create a `POST` request to `http://localhost:8000/extract?output_format=md`.
2. In the `Body` tab, select `form-data`.
3. Add a key `file`, set type to `File`, and upload your `.xlsx` file.
4. Send the request and view the Markdown response.
5. Save the response as `output.md` if needed.

#### Using Swagger UI
1. Open `http://localhost:8000/docs`.
2. Find the `/extract` endpoint and click `Try it out`.
3. Upload an `.xlsx` file, set `output_format` to `md`, and execute.
4. View or download the Markdown response.

## Error Handling
- **400 Bad Request**:
  - If the file isn’t an `.xlsx`: `"Only .xlsx files are supported."`
  - If the file is corrupt or unreadable: `"Error loading workbook: ..."`
  - If the file can’t be read: `"Error reading the file: ..."`
- **Check Your File**: Ensure it’s a valid `.xlsx` with data in the expected format.

## Contributing
- **Bug Reports**: Open an issue with details (e.g., error logs, sample file).
- **Feature Requests**: Suggest improvements like new output formats or detection tweaks.
- **Code Changes**:
  1. Fork the repo.
  2. Create a branch: `git checkout -b feature/your-feature`.
  3. Commit changes: `git commit -m "Add your feature"`.
  4. Push and create a pull request.

---
