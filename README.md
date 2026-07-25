# ReInsight — AI-Powered Reinsurance Analytics

Official repo of the Arch Re project (SwissHacks 2025).

An underwriting assistant: it reads pre-processed reinsurance submissions, uses an
LLM to produce an aggregated analysis (overview, key insights, dashboard tabs),
and lets an underwriter interrogate that analysis conversationally.

> A full audit of the current state — measured timings, bug backlog, security
> findings and the improvement roadmap — lives in [`docs/improvements.md`](docs/improvements.md).

---

## Contents

- [Architecture](#architecture)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [API](#api)
- [Offline preprocessing](#offline-preprocessing)
- [Development](#development)

---

## Architecture

```
frontend/  Next.js 15 (App Router, React 19, Tailwind, Recharts)
           talks to the backend only through its own server-side proxy at
           /api/proxy/* so the browser never holds an API key.

backend/   FastAPI + Uvicorn
           main.py            HTTP API, analysis pipeline, PDF report export
           data/              retrieval index + the corpora it searches
             data_endpoints.py  embedding index and top-k retrieval
             file_parser.py     OFFLINE .xlsx/.pdf/.zip -> Markdown converter
             embeddings_generator.py  OFFLINE corpus -> embeddings.json
```

There is **no database, queue, Redis or vector store**. All state is JSON files
under `backend/data/` and `backend/processed/`.

### What actually happens on a run

1. `POST /submissions/{id}/process` returns immediately and schedules a
   background task.
2. The task concatenates every file in `backend/data/submissions_processed/{id}/`.
3. It retrieves supporting context from a pre-embedded corpus of ~5,000
   economics / industry / news documents.
4. It generates an **overview**, **key insights** and **dashboard tabs**
   concurrently, then writes the dashboard to `backend/data/ai_cached/{id}_dashboard.json`.
5. The UI polls `GET /submissions/{id}/status` and then loads the dashboard.

**Ingestion is offline.** Excel/PDF conversion is a manual script — see
[Offline preprocessing](#offline-preprocessing). The API does not accept uploads.

---

## Quickstart

### Prerequisites

- Python 3.10+
- Node.js 20+
- An OpenAI API key
- ~6 GB of disk for the Python dependencies (`sentence-transformers` pulls in PyTorch)
- Outbound access to `api.openai.com` and, on first run, `huggingface.co`

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

export OPENAI_API_KEY=sk-...        # required - the server will not start without it
.venv/bin/python main.py
```

Serves on **<http://localhost:8000>**, interactive docs at **<http://localhost:8000/docs>**.

To use a different port:

```bash
.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8010
```

> Run the backend **from inside `backend/`** — `data/embeddings.json` and
> `./fonts/DejaVuSerif.ttf` are resolved relative to the working directory.

The first start loads the `all-MiniLM-L6-v2` encoder and the 5,017-vector index
into memory (a few seconds); every later request reuses them.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Serves on **<http://localhost:3000>**.

If the backend is not on port 8000:

```bash
API_URL=http://localhost:8010 npm run dev
```

---

## Configuration

### Backend

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** Read at import time; the process exits without it. |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000` | Comma-separated allowlist. Never set this to `*` — credentials are enabled. |
| `LOG_LEVEL` | `INFO` | Standard `logging` level. |

### Frontend

| Variable | Default | Purpose |
|---|---|---|
| `API_URL` | `http://localhost:8000` | Backend base URL, used **server-side only** by the proxy route. |
| `NEXT_PUBLIC_API_MODE` | `real` | Set to `mock` to run the UI against fixtures with no backend. |

Never put the OpenAI key in a `NEXT_PUBLIC_*` variable — that ships it to the browser.

---

## API

All routes are served from the backend root. Full interactive documentation at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/submissions` | List submissions with real status (`pending` / `processing` / `completed` / `failed`), progress and error. |
| `POST` | `/submissions/{id}/process` | Start analysis. Returns immediately; work runs in the background. |
| `GET` | `/submissions/{id}/status` | Poll status, progress and error text. |
| `GET` | `/dashboards/{id}` | Fetch the generated dashboard JSON. |
| `POST` | `/dashboards/{id}/chat` | Ask a question about a submission. |
| `GET` | `/dashboards/{id}/chat` | Chat history. |
| `DELETE` | `/dashboards/{id}/chat` | Clear chat history. |
| `POST` | `/dashboards/{id}/feedback` | Record thumbs up/down + free text. |
| `POST` | `/dashboards/{id}/ai-response` | Regenerate the dashboard incorporating feedback. |
| `POST` | `/generate-pdf?output_format=pdf\|txt` | Render a dashboard to PDF or plain text. |
| `POST` | `/top_k_related_files` | Retrieval: most similar corpus files for a text. |
| `POST` | `/top_k_related_files_contents` | Retrieval: their concatenated contents. |
| `GET` | `/get-file-contents?filename=` | Read one corpus file (confined to the corpus directory). |

Example:

```bash
curl -X POST http://localhost:8000/submissions/florida/process
curl http://localhost:8000/submissions/florida/status
curl http://localhost:8000/dashboards/florida_dashboard
```

---

## Offline preprocessing

Both steps are manual and are **not** exposed over HTTP.

**1. Documents → Markdown** (`.xlsx` via an openpyxl BFS table detector, `.pdf` via `marker-pdf`):

```bash
cd backend/data
python file_parser.py <input_folder> <output_folder>
```

Place the result in `backend/data/submissions_processed/<submission_id>/`.

**2. Corpus → embeddings** (only needed when `aux_data_processed/` changes):

```bash
cd backend/data
python embeddings_generator.py
```

Writes `embeddings.json`. The script skips files it has already embedded.

---

## Development

Repository layout:

```
backend/data/aux_data_processed/    ~5,000 economics / industry / news documents (the RAG corpus)
backend/data/submissions_processed/ one directory per submission
backend/data/ai_cached/             generated dashboards, chat histories, prompt cache
backend/data/progress/              per-submission job progress
backend/data/feedback/              persisted user feedback (JSONL)
backend/processed/                  final analysis results
```

Runtime directories are gitignored and recreated on boot.

### Known limitations

See [`docs/improvements.md`](docs/improvements.md) for the full backlog. The
headline items:

- The submission corpus is sent to the model in full; very large submissions can
  exceed the context window.
- There is no authentication on the API by default.
- Excel/PDF ingestion is not wired into the application.

## Contributing

1. Branch: `git checkout -b feature/your-feature`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
3. Open a pull request
