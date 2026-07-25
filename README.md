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
           /api/proxy/*, so neither the OpenAI key nor the API token ever
           reaches the browser.

backend/   FastAPI + Uvicorn
           main.py        HTTP API
           config.py      settings, all env-overridable
           auth.py        bearer-token dependency
           schemas.py     Pydantic contracts for every model response
           llm.py         OpenAI access: structured output, streaming, caching
           prompts.py     prompt templates
           pipeline.py    map-reduce analysis pipeline
           jobs.py        durable job records (SQLite)
           retrieval.py   chunk-level semantic search
           chunking.py    token-aware splitting
           ingest.py      upload -> Markdown conversion
           report.py      PDF / text export
           scripts/       build_index.py, benchmark_models.py
           data/file_parser.py   .xlsx/.pdf/.zip -> Markdown converter
```

Job state lives in SQLite (`backend/data/jobs.sqlite3`). Documents, dashboards
and caches are files on disk. There is no queue, Redis or external vector store.

### What happens on a run

1. `POST /submissions/{id}/process` claims the job atomically and returns
   immediately. A second call while one is running gets `409`.
2. **Map** — every document in the submission is summarised once, concurrently.
   Summaries are cached under a hash of the document's content, so an unchanged
   file costs nothing on a re-run.
3. **Retrieve** — the summaries are used to search a chunk-level index over
   ~5,000 economics / industry / news documents.
4. **Reduce** — **overview**, **key insights** and **dashboard tabs** are
   generated concurrently from the summaries plus retrieved context, each
   constrained to a JSON schema and validated on return.
5. The dashboard is persisted, then the job is marked complete. The UI polls
   `GET /submissions/{id}/status`, which reports the current step and progress.

Chat streams its answer over Server-Sent Events, so the first words appear in a
couple of seconds instead of after the whole call.

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

# Build the retrieval index (~6 min on 16 CPU cores, 20,793 chunks / 50 MB).
# Only needed once, and again whenever data/aux_data_processed/ changes.
.venv/bin/python -m scripts.build_index

export OPENAI_API_KEY=sk-...        # required - the server will not start without it
.venv/bin/python main.py
```

See [`backend/.env.example`](backend/.env.example) for every setting.

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

Full list in [`backend/.env.example`](backend/.env.example). The ones that matter:

| Variable | Default | Purpose |
|---|---|---|
| `OPENAI_API_KEY` | — | **Required.** The process will not start without it. |
| `API_TOKEN` | unset | When set, every endpoint requires `Authorization: Bearer <token>`. **Unset means the API is completely open** — fine locally, not otherwise. |
| `OPENAI_MODEL` | `gpt-4o-mini` | Model for the three aggregate generations. Set `o3-mini` to restore the original reasoning model. |
| `OPENAI_SUMMARY_MODEL` | `gpt-4o-mini` | Model for per-document summarisation. |
| `OPENAI_REASONING_EFFORT` | `low` | Only sent to reasoning models (`o*`, `gpt-5`). |
| `OPENAI_TIMEOUT_SECONDS` | `120` | Per-call timeout. The SDK default is 600 s with 2 retries. |
| `CORS_ALLOW_ORIGINS` | `http://localhost:3000` | Comma-separated allowlist. Never `*` — credentials are enabled. |
| `PORT` | `8000` | Backend port. |
| `LOG_LEVEL` | `INFO` | Standard `logging` level. |

### Frontend

| Variable | Default | Purpose |
|---|---|---|
| `API_URL` | `http://localhost:8000` | Backend base URL, used **server-side only** by the proxy route. |
| `API_TOKEN` | unset | Injected as a bearer token by the proxy. Must match the backend's. **Server-side only.** |
| `NEXT_PUBLIC_API_MODE` | `real` | Set to `mock` to run the UI against fixtures with no backend. |

Never put the OpenAI key or the API token in a `NEXT_PUBLIC_*` variable — that
ships them to the browser.

---

## API

All routes are served from the backend root. Full interactive documentation at `/docs`.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness, active models, index state, whether auth is on. No token required. |
| `GET` | `/submissions` | List submissions with real status (`pending` / `processing` / `completed` / `failed` / `cancelled`), progress, current step and error. |
| `POST` | `/submissions` | **Upload** documents (multipart: `submission_id` + `files`). Converts `.xlsx` / `.pdf` / `.zip` / text to Markdown. |
| `POST` | `/submissions/{id}/process` | Start analysis. Returns immediately; `409` if already running. |
| `POST` | `/submissions/{id}/cancel` | Ask a running analysis to stop. |
| `GET` | `/submissions/{id}/status` | Poll status, progress, step and error text. |
| `GET` | `/dashboards/{id}` | Fetch the generated dashboard JSON. |
| `POST` | `/dashboards/{id}/chat/stream` | Ask a question; answer streams back as Server-Sent Events. |
| `POST` | `/dashboards/{id}/chat` | Same, buffered. |
| `GET` | `/dashboards/{id}/chat` | Chat history. |
| `DELETE` | `/dashboards/{id}/chat` | Clear chat history. |
| `POST` | `/dashboards/{id}/feedback` | Record thumbs up/down + free text (persisted to `data/feedback/`). |
| `POST` | `/dashboards/{id}/ai-response` | Revise the affected section from feedback. |
| `POST` | `/generate-pdf?output_format=pdf\|txt` | Render a dashboard to PDF or plain text. |
| `POST` | `/top_k_related_files` | Retrieval: most similar corpus files for a text. |
| `POST` | `/top_k_related_files_contents` | Retrieval: fenced context block. |
| `GET` | `/get-file-contents?filename=` | Read one corpus file (confined to the corpus directory). |

Example:

```bash
curl -X POST http://localhost:8000/submissions/florida/process
curl http://localhost:8000/submissions/florida/status
curl http://localhost:8000/dashboards/florida_dashboard
```

---

## Ingestion and indexing

**Uploading a submission** — over the API, no script needed:

```bash
curl -X POST http://localhost:8000/submissions \
     -F "submission_id=north-sea-2025" \
     -F "files=@exposure.xlsx" \
     -F "files=@wording.pdf"
```

`.xlsx` goes through the openpyxl BFS table detector, `.pdf` through
`marker-pdf`, `.zip` is unpacked and its members converted. Text files are stored
as-is. Everything lands in `backend/data/submissions_processed/<submission_id>/`.

Batch conversion is still available as a script:

```bash
cd backend/data && python file_parser.py <input_folder> <output_folder>
```

**Building the retrieval index** — needed once, and again whenever
`aux_data_processed/` changes:

```bash
cd backend && python -m scripts.build_index
```

Writes `data/index/chunks.npz` + `chunks.jsonl` (build artifacts, gitignored).
CSVs are indexed as one descriptive chunk each and low-information chunks are
dropped; both keep degenerate near-duplicate matches out of the results.

**Comparing models** on your own data (makes real, billed API calls):

```bash
cd backend && python -m scripts.benchmark_models --submission florida \
    --models o3-mini,gpt-4o-mini
```

---

## Development

Repository layout:

```
backend/data/aux_data_processed/    ~5,000 economics / industry / news documents (the RAG corpus)
backend/data/submissions_processed/ one directory per submission
backend/data/index/                 retrieval index (build artifact)
backend/data/ai_cached/             generated dashboards and chat histories
backend/data/llm_cache/             content-addressed model responses
backend/data/feedback/              persisted reviewer feedback (JSONL)
backend/data/jobs.sqlite3           job records
backend/processed/                  final analysis results
```

Runtime directories are gitignored and recreated on boot.

### Tests

```bash
cd backend && .venv/bin/python -m pytest        # 96 tests, no network calls
cd frontend && npx tsc --noEmit                 # type check
```

### Known limitations

See [`docs/improvements.md`](docs/improvements.md) for the full backlog and
[`docs/data-handling.md`](docs/data-handling.md) for what leaves the machine.
The headline items:

- `API_TOKEN` is a single shared secret. There is no user model, so there is no
  per-user data scoping — anyone with the token sees every submission.
- Submission data is unencrypted at rest and nothing expires automatically.
- The default model (`o3-mini`) has not been benchmarked against alternatives on
  this data; use `scripts/benchmark_models.py` before tuning for latency.

## Contributing

1. Branch: `git checkout -b feature/your-feature`
2. Commit using [Conventional Commits](https://www.conventionalcommits.org/)
3. Open a pull request
