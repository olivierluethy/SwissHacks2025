"""Bearer-token authentication (SEC-002).

The app has no user model, so this is deliberately not one: a single shared
token, supplied by the deployment, checked on every route. It closes the actual
hole - an API that anyone who could reach the port could read, drive and bill -
without inventing accounts a prototype does not have.

Set `API_TOKEN` to enable it. When unset the API stays open, which is the
existing behaviour and is fine for a local single-user run; `/health` reports
which mode is active.

Per-user data scoping is a separate piece of work and is still open; see
docs/improvements.md (SEC-002).
"""

from __future__ import annotations

import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, status

import config

logger = logging.getLogger("archre.auth")

_warned = False


def require_token(authorization: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: accept `Authorization: Bearer <API_TOKEN>`."""
    global _warned

    expected = config.API_TOKEN
    if not expected:
        if not _warned:
            logger.warning(
                "auth.disabled - API_TOKEN is not set, every endpoint is open. "
                "Set API_TOKEN before exposing this service."
            )
            _warned = True
        return

    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    supplied = authorization.split(" ", 1)[1].strip()
    # Constant-time comparison so the token cannot be recovered by timing.
    if not hmac.compare_digest(supplied, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
