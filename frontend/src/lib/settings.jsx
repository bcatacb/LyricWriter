import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const SettingsContext = createContext(null);

const LS_KEY = "lyricist.settings.v2";
const BACKEND_API = process.env.REACT_APP_BACKEND_URL + "/api";

const defaultSettings = {
    provider: "lmstudio",
    model: "hermes-3-llama-3.1-8b",
    endpoints: {
        ollama: "http://localhost:11434",
        lmstudio: "https://desktop-pslrnct.tail763538.ts.net",
    },
    localApiKey: "",
    localModels: {
        ollama: "",
        lmstudio: "",
    },
};

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(() => {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
        } catch {}
        return defaultSettings;
    });

    const [availableModels, setAvailableModels] = useState([]);

    // Sync to localStorage
    useEffect(() => {
        localStorage.setItem(LS_KEY, JSON.stringify(settings));
    }, [settings]);

    // Initial load: Fetch global defaults from backend
    useEffect(() => {
        axios.get(`${BACKEND_API}/settings`).then(r => {
            if (r.data.lmstudio_endpoint) {
                update({
                    endpoints: {
                        ollama: r.data.ollama_endpoint || settings.endpoints.ollama,
                        lmstudio: r.data.lmstudio_endpoint || settings.endpoints.lmstudio,
                    }
                });
            }
        }).catch(e => console.warn("Failed to fetch global settings", e));
    }, []);

    // Auto-probe models when endpoint or provider changes
    useEffect(() => {
        const isLocal = settings.provider === "ollama" || settings.provider === "lmstudio";
        if (isLocal) {
            const endpoint = settings.endpoints[settings.provider];
            if (endpoint) {
                axios.get(`${BACKEND_API}/probe?endpoint=${encodeURIComponent(endpoint)}`)
                    .then(r => {
                        if (r.data.ok) {
                            setAvailableModels(r.data.models || []);
                        }
                    })
                    .catch(() => setAvailableModels([]));
            }
        } else {
            setAvailableModels([]);
        }
    }, [settings.provider, settings.endpoints.ollama, settings.endpoints.lmstudio]);

    const update = (patch) => setSettings((s) => ({ ...s, ...patch }));

    const resolveForRequest = () => {
        const { provider, model, endpoints, localApiKey, localModels } = settings;
        if (provider === "ollama" || provider === "lmstudio") {
            return {
                provider,
                model: localModels[provider] || model,
                endpoint: endpoints[provider],
                api_key: localApiKey || null,
            };
        }
        return { provider, model };
    };

    return (
        <SettingsContext.Provider value={{ settings, update, resolveForRequest, availableModels }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings outside provider");
    return ctx;
};
