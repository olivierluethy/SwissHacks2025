"""OpenAI access: structured output, streaming, timeouts and content caching.

Replaces the previous pattern of "build a giant f-string prompt, send it, then
regex-repair whatever came back".

- IMP-006 / BUG-003: every non-streaming call goes through a JSON schema and is
  validated into a Pydantic model. There is no regex repair.
- IMP-005: explicit timeout, retry budget and completion-token cap. The SDK
  defaults (600 s read, 2 retries) allowed a single call to hold a job for half
  an hour.
- IMP-008: responses are cached under a hash of (model, schema, prompt), so an
  unchanged input costs nothing on a re-run.
- IMP-003: `stream_text` yields tokens as they arrive.
- SEC-006: prompts are never logged; only sizes, token counts and durations.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Iterator, Optional, Type, TypeVar

from openai import OpenAI
from pydantic import BaseModel, ValidationError

import config

logger = logging.getLogger("archre.llm")

T = TypeVar("T", bound=BaseModel)

_client: Optional[OpenAI] = None


class AIQueryError(RuntimeError):
    """The model call failed, or returned something that does not validate."""


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(
            timeout=config.OPENAI_TIMEOUT_SECONDS,
            max_retries=config.OPENAI_MAX_RETRIES,
        )
    return _client


def _is_reasoning_model(model: str) -> bool:
    return model.startswith(("o1", "o3", "o4", "gpt-5"))


def _token_params(model: str) -> dict:
    """Reasoning models reject `max_tokens` and `temperature`."""
    if _is_reasoning_model(model):
        params = {"max_completion_tokens": config.MAX_COMPLETION_TOKENS}
        if config.REASONING_EFFORT:
            params["reasoning_effort"] = config.REASONING_EFFORT
        return params
    return {"max_tokens": config.MAX_COMPLETION_TOKENS, "temperature": 0.2}


# ---------------------------------------------------------------------------
# Cache (IMP-008)
# ---------------------------------------------------------------------------
def cache_key(model: str, prompt: str, schema_name: str) -> str:
    digest = hashlib.sha256()
    digest.update(model.encode())
    digest.update(b"\x00")
    digest.update(schema_name.encode())
    digest.update(b"\x00")
    digest.update(prompt.encode())
    return digest.hexdigest()


def _cache_path(key: str):
    config.LLM_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    return config.LLM_CACHE_DIR / f"{key}.json"


def _cache_read(key: str) -> Optional[dict]:
    path = _cache_path(key)
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _cache_write(key: str, payload: dict) -> None:
    try:
        _cache_path(key).write_text(
            json.dumps(payload, indent=2), encoding="utf-8"
        )
    except Exception as e:  # caching must never break a request
        logger.warning("llm.cache_write_failed error=%s", e)


# ---------------------------------------------------------------------------
# Structured completion
# ---------------------------------------------------------------------------
def _response_format(schema: Type[BaseModel]) -> dict:
    json_schema = schema.model_json_schema()
    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema.__name__,
            "schema": json_schema,
            "strict": False,
        },
    }


def structured(
    prompt: str,
    schema: Type[T],
    *,
    model: Optional[str] = None,
    label: str = "call",
    use_cache: bool = True,
) -> T:
    """Run a completion constrained to `schema` and return the validated model."""
    model = model or config.MODEL_NAME
    key = cache_key(model, prompt, schema.__name__)

    if use_cache:
        cached = _cache_read(key)
        if cached is not None:
            try:
                result = schema.model_validate(cached)
                logger.info("llm.cache_hit label=%s schema=%s", label, schema.__name__)
                return result
            except ValidationError:
                logger.info("llm.cache_stale label=%s", label)

    started = time.perf_counter()
    try:
        response = get_client().chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            response_format=_response_format(schema),
            **_token_params(model),
        )
    except Exception as e:
        logger.error("llm.error label=%s model=%s error=%s", label, model, e)
        raise AIQueryError(str(e)) from e

    elapsed = time.perf_counter() - started
    message = response.choices[0].message
    if getattr(message, "refusal", None):
        raise AIQueryError(f"Model refused the request: {message.refusal}")

    content = message.content or ""
    usage = getattr(response, "usage", None)
    logger.info(
        "llm.done label=%s model=%s elapsed=%.2fs prompt_chars=%d "
        "input_tokens=%s output_tokens=%s",
        label,
        model,
        elapsed,
        len(prompt),
        getattr(usage, "prompt_tokens", "?"),
        getattr(usage, "completion_tokens", "?"),
    )

    if getattr(response.choices[0], "finish_reason", None) == "length":
        # BUG-003: truncated output used to reach a regex parser and fail with an
        # opaque JSONDecodeError. Say what actually happened.
        raise AIQueryError(
            f"Model output hit the {config.MAX_COMPLETION_TOKENS}-token completion "
            "limit and was truncated. Raise OPENAI_MAX_COMPLETION_TOKENS or reduce input."
        )

    try:
        payload = json.loads(content)
    except json.JSONDecodeError as e:
        raise AIQueryError(f"Model did not return JSON: {e}") from e

    try:
        result = schema.model_validate(payload)
    except ValidationError as e:
        raise AIQueryError(f"Model output failed schema validation: {e}") from e

    if use_cache:
        _cache_write(key, payload)
    return result


# ---------------------------------------------------------------------------
# Streaming (IMP-003)
# ---------------------------------------------------------------------------
def stream_text(
    prompt: str,
    *,
    model: Optional[str] = None,
    label: str = "stream",
) -> Iterator[str]:
    """Yield response text incrementally.

    Used for chat, where showing the first sentence in ~2 s matters far more
    than the total duration.
    """
    model = model or config.MODEL_NAME
    started = time.perf_counter()
    first_token_at: Optional[float] = None
    total = 0

    try:
        stream = get_client().chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=True,
            **_token_params(model),
        )
        for chunk in stream:
            if not chunk.choices:
                continue
            piece = chunk.choices[0].delta.content
            if piece:
                if first_token_at is None:
                    first_token_at = time.perf_counter()
                total += len(piece)
                yield piece
    except Exception as e:
        logger.error("llm.stream_error label=%s error=%s", label, e)
        raise AIQueryError(str(e)) from e

    logger.info(
        "llm.stream_done label=%s model=%s ttft=%.2fs total=%.2fs chars=%d",
        label,
        model,
        (first_token_at - started) if first_token_at else -1.0,
        time.perf_counter() - started,
        total,
    )
