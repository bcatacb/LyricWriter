"""Unified LLM router: supports Emergent cloud (Claude/GPT/Gemini), Ollama, LM Studio."""
import os
import logging
import httpx
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger(__name__)


CLOUD_MODELS = {
    "anthropic": [
        "claude-sonnet-4-5-20250929",
        "claude-haiku-4-5-20251001",
        "claude-opus-4-5-20251101",
    ],
    "openai": [
        "gpt-5.2",
        "gpt-5.1",
        "gpt-5-mini",
        "gpt-4.1",
    ],
    "gemini": [
        "gemini-3.1-pro-preview",
        "gemini-3-flash-preview",
        "gemini-2.5-pro",
    ],
}


async def _call_cloud(
    provider: str, model: str, system: str, user: str, session_id: str
) -> str:
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY is not configured on the server")
    chat = LlmChat(
        api_key=key, session_id=session_id, system_message=system
    ).with_model(provider, model)
    resp = await chat.send_message(UserMessage(text=user))
    return str(resp)


async def _call_openai_compatible(
    base_url: str, model: str, system: str, user: str, api_key: str | None = None
) -> str:
    """Call OpenAI-compatible endpoint (Ollama /v1, LM Studio /v1, etc)."""
    base_url = base_url.rstrip("/")
    if not base_url.endswith("/v1"):
        # Ollama exposes at /v1; LM Studio default is already /v1. Be lenient.
        if "/v1" not in base_url:
            base_url = base_url + "/v1"
    url = f"{base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.9,
        "stream": False,
    }
    async with httpx.AsyncClient(timeout=180.0) as client:
        r = await client.post(url, json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()
    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"Unexpected response shape from local LLM: {data}") from e


async def call_llm(
    provider: str,
    model: str,
    system: str,
    user: str,
    session_id: str = "lyricist",
    endpoint: str | None = None,
    api_key: str | None = None,
) -> str:
    """
    provider: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'lmstudio'
    endpoint: required for ollama/lmstudio
    """
    provider = provider.lower().strip()
    if provider in ("anthropic", "openai", "gemini"):
        return await _call_cloud(provider, model, system, user, session_id)
    if provider in ("ollama", "lmstudio"):
        if not endpoint:
            raise RuntimeError(f"Endpoint URL is required for {provider}")
        return await _call_openai_compatible(endpoint, model, system, user, api_key)
    raise RuntimeError(f"Unknown provider: {provider}")


async def probe_endpoint(endpoint: str, api_key: str | None = None) -> dict:
    """Test an Ollama/LM Studio endpoint by listing models."""
    base = endpoint.rstrip("/")
    if "/v1" not in base:
        base = base + "/v1"
    url = f"{base}/models"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            r = await client.get(url, headers=headers)
            r.raise_for_status()
            data = r.json()
        models = []
        for m in data.get("data", []):
            mid = m.get("id") or m.get("name")
            if mid:
                models.append(mid)
        return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "error": str(e), "models": []}
