# Data handling

Addresses **SEC-008** from [`improvements.md`](improvements.md). This documents
what the system does today so the remaining decisions are explicit rather than
implicit. **It is not legal advice and it is not a completed compliance
position** — the items under [Open decisions](#open-decisions) need an owner.

## What data the system holds

| Category | Where | Sensitivity |
|---|---|---|
| Reinsurance submissions (treaty wordings, exposures, PMLs, loss history) | `backend/data/submissions_processed/<id>/` | **Confidential, client-owned** |
| Per-document summaries | `backend/data/llm_cache/` | Derived from the above; equally confidential |
| Generated dashboards | `backend/data/ai_cached/`, `backend/processed/` | Confidential |
| Chat transcripts | `backend/data/ai_cached/<id>_chat.json` | Confidential |
| Reviewer feedback | `backend/data/feedback/*.jsonl` | Internal |
| Job records | `backend/data/jobs.sqlite3` | Metadata only |
| Public reference corpus | `backend/data/aux_data_processed/` | Public |

All of it is unencrypted on local disk. There is no per-record retention policy
and nothing is purged automatically.

## What leaves the machine

Exactly one destination: the **OpenAI API**.

| Trigger | What is sent |
|---|---|
| Analysis run | Each submission document once, for summarisation; then the summaries plus retrieved public reference text |
| Chat message | Cached summaries, retrieved reference text, the last 10 turns, the question |
| Feedback revision | Cached summaries, the section under revision, the reviewer's comment |

The map-reduce change means **raw submission text is sent once per document per
content change** instead of in full on every call — previously the entire corpus
went out three times per run and again on every chat message and feedback click.
Cached summaries mean an unchanged document is never re-sent.

Nothing is sent to any other third party. The embedding model runs locally; the
`all-MiniLM-L6-v2` weights are downloaded from Hugging Face once at first start
and no data is sent there.

## What is not done

- **No redaction.** Named insureds, locations and claim details reach the model verbatim.
- **No encryption at rest.**
- **No retention limits.** Caches and transcripts grow until deleted by hand.
- **No per-user access control.** `API_TOKEN` gates the whole API; everyone holding it sees every submission (SEC-002).
- **No audit trail** of who viewed or exported what.

## What is done

- The API key is server-side only; it is never sent to the browser.
- Payloads are never written to logs — only sizes, token counts and durations (SEC-006).
- Retrieved third-party text is fenced and marked untrusted before it enters a prompt (SEC-004).
- Model-generated HTML is sanitised before rendering (SEC-005).
- Runtime state directories are gitignored, so submissions cannot be committed by accident.
- File reads are confined to the corpus directory (SEC-001).

## Open decisions

These need a human owner; they are policy, not code.

1. **Does your OpenAI agreement cover client submission data?** Check whether
   you are on a zero-data-retention arrangement. By default the API retains
   inputs for up to 30 days for abuse monitoring.
2. **Do your client contracts permit sending submissions to a US-based
   subprocessor?** For EU cedants this is a GDPR transfer question.
3. **Retention.** How long should summaries, dashboards and chat transcripts be
   kept? Nothing expires today.
4. **Encryption at rest**, if this ever runs anywhere but a controlled machine.
5. **Whether per-user scoping is required** before more than one team uses it.

## Deleting data

There is no UI for this. On disk:

```bash
cd backend
rm -rf data/submissions_processed/<id>          # source documents
rm -f  data/ai_cached/<id>_dashboard.json       # dashboard
rm -f  data/ai_cached/<id>_dashboard_chat.json  # chat transcript
rm -f  processed/<id>_result.json               # exported result
rm -rf data/llm_cache                           # cached summaries (all submissions)
sqlite3 data/jobs.sqlite3 "DELETE FROM jobs WHERE submission_id = '<id>';"
```

`data/llm_cache` is content-addressed, so clearing it is safe: entries are
regenerated on the next run at the cost of re-calling the model.
