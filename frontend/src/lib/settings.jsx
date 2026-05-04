import React, { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext(null);

const LS_KEY = "lyricist.settings.v1";

const defaultSettings = {
    provider: "anthropic",
    model: "claude-sonnet-4-5-20250929",
    endpoints: {
        ollama: "http://localhost:11434",
        lmstudio: "http://localhost:1234/v1",
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

    useEffect(() => {
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(settings));
        } catch {}
    }, [settings]);

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
        <SettingsContext.Provider value={{ settings, update, resolveForRequest }}>
            {children}
        </SettingsContext.Provider>
    );
}

export const useSettings = () => {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error("useSettings outside provider");
    return ctx;
};
