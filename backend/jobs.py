"""Durable job records backed by SQLite.

BUG-009: processing was not idempotent and had no lock. Two POSTs - a double
click, or the retry the UI used to invite after a failure - started two
background tasks writing the same progress file, and the last writer won.
`claim()` is an atomic conditional insert/update, so a second start is rejected.

BUG-010: jobs could sit in "processing" forever. A restart left a file claiming
work that no task was doing, and nothing timed out. Jobs now carry timestamps and
a heartbeat, `recover_stale()` runs at boot, and `request_cancel()` gives the
pipeline something to check (IMP-010).

IMP-009: `step` and `progress` are updated as real work completes rather than
jumping 0 -> 33 -> 66 -> 100 with multi-minute gaps.
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional

import config

logger = logging.getLogger("archre.jobs")

PENDING = "pending"
PROCESSING = "processing"
COMPLETED = "completed"
FAILED = "failed"
CANCELLED = "cancelled"

ACTIVE_STATES = (PROCESSING,)

_lock = threading.Lock()
_connection: Optional[sqlite3.Connection] = None

SCHEMA = """
CREATE TABLE IF NOT EXISTS jobs (
    submission_id     TEXT PRIMARY KEY,
    status            TEXT NOT NULL,
    progress          INTEGER NOT NULL DEFAULT 0,
    step              TEXT,
    error             TEXT,
    result            TEXT,
    cancel_requested  INTEGER NOT NULL DEFAULT 0,
    created_at        REAL NOT NULL,
    updated_at        REAL NOT NULL,
    heartbeat_at      REAL
);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs(status);
"""


@dataclass
class Job:
    submission_id: str
    status: str = PENDING
    progress: int = 0
    step: Optional[str] = None
    error: Optional[str] = None
    result: Optional[dict] = None
    cancel_requested: bool = False
    created_at: float = 0.0
    updated_at: float = 0.0
    heartbeat_at: Optional[float] = None

    def to_api(self) -> dict:
        return {
            "id": self.submission_id,
            "status": self.status,
            "progress": self.progress,
            "step": self.step,
            "error": self.error,
            "updatedAt": (
                datetime.fromtimestamp(self.updated_at, timezone.utc).isoformat()
                if self.updated_at
                else None
            ),
        }


def _connect() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        config.JOBS_DB.parent.mkdir(parents=True, exist_ok=True)
        _connection = sqlite3.connect(
            str(config.JOBS_DB), check_same_thread=False, timeout=30
        )
        _connection.row_factory = sqlite3.Row
        _connection.execute("PRAGMA journal_mode=WAL")
        _connection.executescript(SCHEMA)
        _connection.commit()
    return _connection


def init() -> None:
    with _lock:
        _connect()


def _row_to_job(row: sqlite3.Row) -> Job:
    return Job(
        submission_id=row["submission_id"],
        status=row["status"],
        progress=row["progress"],
        step=row["step"],
        error=row["error"],
        result=json.loads(row["result"]) if row["result"] else None,
        cancel_requested=bool(row["cancel_requested"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        heartbeat_at=row["heartbeat_at"],
    )


def get(submission_id: str) -> Optional[Job]:
    with _lock:
        cursor = _connect().execute(
            "SELECT * FROM jobs WHERE submission_id = ?", (submission_id,)
        )
        row = cursor.fetchone()
    return _row_to_job(row) if row else None


def all_jobs() -> List[Job]:
    with _lock:
        rows = _connect().execute("SELECT * FROM jobs").fetchall()
    return [_row_to_job(row) for row in rows]


def claim(submission_id: str) -> bool:
    """Atomically move a submission into `processing`.

    Returns False if a run is already in flight - this is the idempotency guard.
    """
    now = time.time()
    with _lock:
        conn = _connect()
        with conn:  # BEGIN/COMMIT, so the SELECT and the write cannot interleave
            row = conn.execute(
                "SELECT status FROM jobs WHERE submission_id = ?", (submission_id,)
            ).fetchone()
            if row is not None and row["status"] in ACTIVE_STATES:
                return False
            conn.execute(
                """
                INSERT INTO jobs (submission_id, status, progress, step, error,
                                  result, cancel_requested, created_at, updated_at,
                                  heartbeat_at)
                VALUES (?, ?, 0, ?, NULL, NULL, 0, ?, ?, ?)
                ON CONFLICT(submission_id) DO UPDATE SET
                    status = excluded.status,
                    progress = 0,
                    step = excluded.step,
                    error = NULL,
                    result = NULL,
                    cancel_requested = 0,
                    updated_at = excluded.updated_at,
                    heartbeat_at = excluded.heartbeat_at
                """,
                (submission_id, PROCESSING, "queued", now, now, now),
            )
    logger.info("job.claimed submission=%s", submission_id)
    return True


def update(
    submission_id: str,
    *,
    progress: Optional[int] = None,
    step: Optional[str] = None,
) -> None:
    now = time.time()
    fields = ["updated_at = ?", "heartbeat_at = ?"]
    values: List = [now, now]
    if progress is not None:
        fields.append("progress = ?")
        values.append(int(progress))
    if step is not None:
        fields.append("step = ?")
        values.append(step)
    values.append(submission_id)
    with _lock:
        conn = _connect()
        with conn:
            conn.execute(
                f"UPDATE jobs SET {', '.join(fields)} WHERE submission_id = ?",
                values,
            )
    if step:
        logger.info(
            "job.progress submission=%s step=%s progress=%s",
            submission_id,
            step,
            progress,
        )


def finish(submission_id: str, result: dict) -> None:
    now = time.time()
    with _lock:
        conn = _connect()
        with conn:
            conn.execute(
                """UPDATE jobs SET status = ?, progress = 100, step = 'done',
                   error = NULL, result = ?, updated_at = ?, heartbeat_at = ?
                   WHERE submission_id = ?""",
                (COMPLETED, json.dumps(result), now, now, submission_id),
            )
    logger.info("job.completed submission=%s", submission_id)


def fail(submission_id: str, step: str, error: str) -> None:
    now = time.time()
    with _lock:
        conn = _connect()
        with conn:
            conn.execute(
                """UPDATE jobs SET status = ?, step = ?, error = ?,
                   updated_at = ?, heartbeat_at = ? WHERE submission_id = ?""",
                (FAILED, step, error[:4000], now, now, submission_id),
            )
    logger.error("job.failed submission=%s step=%s error=%s", submission_id, step, error)


def cancel(submission_id: str) -> None:
    now = time.time()
    with _lock:
        conn = _connect()
        with conn:
            conn.execute(
                """UPDATE jobs SET status = ?, step = 'cancelled',
                   updated_at = ?, heartbeat_at = ? WHERE submission_id = ?""",
                (CANCELLED, now, now, submission_id),
            )
    logger.info("job.cancelled submission=%s", submission_id)


def request_cancel(submission_id: str) -> bool:
    """IMP-010: ask a running job to stop at its next checkpoint."""
    with _lock:
        conn = _connect()
        with conn:
            cursor = conn.execute(
                """UPDATE jobs SET cancel_requested = 1, updated_at = ?
                   WHERE submission_id = ? AND status = ?""",
                (time.time(), submission_id, PROCESSING),
            )
    return cursor.rowcount > 0


def is_cancel_requested(submission_id: str) -> bool:
    with _lock:
        row = _connect().execute(
            "SELECT cancel_requested FROM jobs WHERE submission_id = ?",
            (submission_id,),
        ).fetchone()
    return bool(row and row["cancel_requested"])


def recover_stale(max_age_seconds: Optional[int] = None) -> int:
    """BUG-010: mark abandoned `processing` jobs as failed.

    Called at startup: any job still marked processing cannot have a live task
    behind it, because the task lived in this process.
    """
    max_age = max_age_seconds if max_age_seconds is not None else config.JOB_STALE_SECONDS
    cutoff = time.time() - max_age
    now = time.time()
    with _lock:
        conn = _connect()
        with conn:
            cursor = conn.execute(
                """UPDATE jobs SET status = ?, error = ?, updated_at = ?
                   WHERE status = ? AND (heartbeat_at IS NULL OR heartbeat_at < ?)""",
                (
                    FAILED,
                    "Job was interrupted (server restart or timeout) and did not finish.",
                    now,
                    PROCESSING,
                    cutoff,
                ),
            )
    if cursor.rowcount:
        logger.warning("job.recovered_stale count=%d", cursor.rowcount)
    return cursor.rowcount


def recover_all_processing() -> int:
    """Startup recovery: nothing can still be running after a restart."""
    return recover_stale(max_age_seconds=-1)


def reset_for_tests(db_path=None) -> None:
    global _connection
    with _lock:
        if _connection is not None:
            _connection.close()
        _connection = None
    if db_path is not None:
        config.JOBS_DB = db_path
