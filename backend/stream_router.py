"""SSE streaming for lyric generation.

Strategy:
- For local (ollama/lmstudio): true token streaming via httpx SSE.
- For cloud (anthropic/openai/gemini): fetch the full response
  then word-trickle it back to the client as SSE chunks. Same UX.
"""
import asyncio
import json
import logging
import os
from typing import AsyncIterator, Optional

import httpx
# Direct cloud provider support implemented.


logger = logging.getLogger(__name__)

CLOUD_PROVIDERS = {"anthropic", "openai", "gemini"}
LOCAL_PROVIDERS = {"ollama", "lmstudio"}


def _sse(event: str, data) -> bytes:
    if not isinstance(data, str):
        data = json.dumps(data)
    # SSE event format
    return f"event: {event}\ndata: {data}\n\n".encode("utf-8")


async def _cloud_word_trickle(
    provider: str, model: str, system: str, user: str, session_id: str
) -> AsyncIterator[bytes]:
    from .llm_router import call_llm
    
    yield _sse("status", {"message": f"calling {provider} cloud…"})
    try:
        full = await call_llm(provider, model, system, user, session_id)
    except Exception as e:
        logger.exception("Cloud LLM failed")
        yield _sse("error", {"message": str(e)})
        return

    full = str(full or "")
    # Word-level trickle so the UI feels alive.
    tokens = []
    current = ""
    for ch in full:
        current += ch
        if ch in (" ", "\n"):
            tokens.append(current)
            current = ""
    if current:
        tokens.append(current)

    for tok in tokens:
        yield _sse("delta", {"text": tok})
        if "\n" not in tok:
            await asyncio.sleep(0.018)

    yield _sse("done", {"lyrics": full, "provider": provider, "model": model})


async def _local_stream(
    provider: str,
    model: str,
    system: str,
    user: str,
    endpoint: str,
    api_key: Optional[str],
) -> AsyncIterator[bytes]:
    base = endpoint.rstrip("/")
    if "/v1" not in base:
        base = base + "/v1"
    url = f"{base}/chat/completions"
    headers = {"Content-Type": "application/json", "Accept": "text/event-stream"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.9,
        "stream": True,
    }

    yield _sse("status", {"message": f"connecting to {provider}…"})
    accumulated = ""
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST", url, headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    if line.startswith("data: "):
                        line = line[6:]
                    if line.strip() == "[DONE]":
                        break
                    try:
                        chunk = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    piece = delta.get("content") or ""
                    if piece:
                        accumulated += piece
                        yield _sse("delta", {"text": piece})
    except Exception as e:
        logger.exception("Local stream failed")
        yield _sse("error", {"message": str(e)})
        return

    yield _sse(
        "done",
        {"lyrics": accumulated, "provider": provider, "model": model},
    )


async def stream_llm(
    provider: str,
    model: str,
    system: str,
    user: str,
    session_id: str,
    endpoint: Optional[str] = None,
    api_key: Optional[str] = None,
) -> AsyncIterator[bytes]:
    if provider in CLOUD_PROVIDERS:
        async for chunk in _cloud_word_trickle(provider, model, system, user, session_id):
            yield chunk
        return
    if provider in LOCAL_PROVIDERS:
        if not endpoint:
            yield _sse("error", {"message": f"endpoint required for {provider}"})
            return
        async for chunk in _local_stream(
            provider, model, system, user, endpoint, api_key
        ):
            yield chunk
        return
    yield _sse("error", {"message": f"unknown provider {provider}"})
