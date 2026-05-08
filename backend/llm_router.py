"""Unified LLM router: supports cloud providers (Claude/GPT/Gemini), Ollama, LM Studio."""
import os
import logging
import httpx


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
    """Call cloud LLM providers directly using environment API keys."""
    if provider == "openai":
        key = os.environ.get("OPENAI_API_KEY")
        if not key:
            raise RuntimeError("OPENAI_API_KEY not found in environment")
        return await _call_openai_compatible("https://api.openai.com/v1", model, system, user, key)
    
    if provider == "anthropic":
        key = os.environ.get("ANTHROPIC_API_KEY")
        if not key:
            raise RuntimeError("ANTHROPIC_API_KEY not found in environment")
        
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        }
        payload = {
            "model": model,
            "max_tokens": 4096,
            "system": system,
            "messages": [{"role": "user", "content": user}],
            "temperature": 0.9,
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(url, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            return data["content"][0]["text"]

    if provider == "gemini":
        key = os.environ.get("GOOGLE_API_KEY")
        if not key:
            raise RuntimeError("GOOGLE_API_KEY not found in environment")
        
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"
        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"System Instruction: {system}\n\nUser: {user}"}]
                }
            ],
            "generationConfig": {
                "temperature": 0.9,
                "maxOutputTokens": 4096,
            }
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            data = r.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]

    raise RuntimeError(f"Cloud provider {provider} not implemented in direct mode")


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
