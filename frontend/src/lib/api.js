import axios from "axios";

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
    baseURL: API,
    timeout: 180000,
});

// Provider & model helpers
export const CLOUD_PROVIDERS = [
    {
        id: "anthropic",
        label: "Anthropic (Claude)",
        models: [
            "claude-sonnet-4-5-20250929",
            "claude-haiku-4-5-20251001",
            "claude-opus-4-5-20251101",
        ],
    },
    {
        id: "openai",
        label: "OpenAI",
        models: ["gpt-5.2", "gpt-5.1", "gpt-5-mini", "gpt-4.1"],
    },
    {
        id: "gemini",
        label: "Google Gemini",
        models: [
            "gemini-3.1-pro-preview",
            "gemini-3-flash-preview",
            "gemini-2.5-pro",
        ],
    },
];

export const LOCAL_PROVIDERS = [
    { id: "ollama", label: "Ollama (local)", default_endpoint: "http://localhost:11434" },
    { id: "lmstudio", label: "LM Studio (local)", default_endpoint: "http://localhost:1234/v1" },
];
