import React, { useState } from "react";
import { toast } from "sonner";
import { useSettings } from "../lib/settings";
import { api } from "../lib/api";
import { CheckCircleIcon, WarningIcon, CloudIcon, TerminalWindowIcon } from "@phosphor-icons/react";

export default function SettingsPage() {
    const { settings, update } = useSettings();
    const [testing, setTesting] = useState(null);
    const [results, setResults] = useState({});

    const testEndpoint = async (name) => {
        setTesting(name);
        try {
            const r = await api.post("/providers/test", {
                endpoint: settings.endpoints[name],
                api_key: settings.localApiKey || null,
            });
            setResults((p) => ({ ...p, [name]: r.data }));
            if (r.data.ok) {
                toast.success(`${name} reachable`, { description: `${r.data.models.length} model(s) found` });
            } else {
                toast.error(`${name} failed`, { description: r.data.error });
            }
        } catch (e) {
            const err = e?.response?.data?.detail || e.message;
            setResults((p) => ({ ...p, [name]: { ok: false, error: err, models: [] } }));
            toast.error("Test failed", { description: err });
        } finally {
            setTesting(null);
        }
    };

    return (
        <div className="max-w-[1100px] mx-auto px-6 py-8" data-testid="settings-page">
            <div className="mb-6">
                <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#39FF14]">/providers</div>
                <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#EDEDED] mt-2">
                    LLM Providers
                </h1>
                <p className="text-[#A0A0A0] mt-2">
                    Route lyrics generation through cloud giants or your own rig. Local endpoints stay on your machine.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="border border-[#222] bg-[#121212] p-5" data-testid="cloud-info">
                    <div className="flex items-center gap-2 mb-2">
                        <CloudIcon size={20} color="#39FF14" weight="duotone" />
                        <div className="font-display text-lg font-bold text-[#EDEDED]">Cloud Providers</div>
                    </div>
                    <div className="text-sm text-[#A0A0A0] leading-relaxed">
                        Claude (Anthropic), GPT (OpenAI), Gemini (Google) are routed through your Emergent Universal Key.
                        Usage deducts from your Emergent balance. Switch model in the Studio Control Room.
                    </div>
                </div>
                <div className="border border-[#222] bg-[#121212] p-5" data-testid="local-info">
                    <div className="flex items-center gap-2 mb-2">
                        <TerminalWindowIcon size={20} color="#39FF14" weight="duotone" />
                        <div className="font-display text-lg font-bold text-[#EDEDED]">Local Providers</div>
                    </div>
                    <div className="text-sm text-[#A0A0A0] leading-relaxed">
                        Ollama &amp; LM Studio are queried on their OpenAI-compatible endpoints. Works best when this
                        backend runs on your own machine. Remote browser + local endpoint will fail with "connection
                        refused".
                    </div>
                </div>
            </div>

            {["ollama", "lmstudio"].map((name) => (
                <div key={name} className="border border-[#222] bg-[#121212] p-5 mb-4" data-testid={`endpoint-card-${name}`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="font-display text-xl font-bold uppercase tracking-tight text-[#39FF14]">
                            {name === "ollama" ? "Ollama" : "LM Studio"}
                        </div>
                        {results[name] && (
                            <span
                                className={[
                                    "flex items-center gap-1 text-xs font-mono tracking-widest uppercase",
                                    results[name].ok ? "text-[#39FF14]" : "text-red-400",
                                ].join(" ")}
                                data-testid={`endpoint-status-${name}`}
                            >
                                {results[name].ok ? <CheckCircleIcon size={12} weight="fill" /> : <WarningIcon size={12} weight="fill" />}
                                {results[name].ok ? "CONNECTED" : "FAILED"}
                            </span>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                        <input
                            value={settings.endpoints[name]}
                            onChange={(e) => update({ endpoints: { ...settings.endpoints, [name]: e.target.value } })}
                            className="bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#39FF14]"
                            placeholder={name === "ollama" ? "http://localhost:11434" : "http://localhost:1234/v1"}
                            data-testid={`endpoint-input-${name}`}
                        />
                        <button
                            onClick={() => testEndpoint(name)}
                            disabled={testing === name}
                            className="bg-[#39FF14] text-black font-bold uppercase tracking-[0.2em] text-xs px-4 py-2 hover:bg-[#00FF41] disabled:opacity-60"
                            data-testid={`endpoint-test-${name}`}
                        >
                            {testing === name ? "TESTING…" : "TEST CONNECTION"}
                        </button>
                    </div>
                    {results[name]?.ok && results[name].models.length > 0 && (
                        <div className="mt-3">
                            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666] mb-2">Available models</div>
                            <div className="flex flex-wrap gap-2">
                                {results[name].models.map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => update({
                                            provider: name,
                                            localModels: { ...settings.localModels, [name]: m },
                                        })}
                                        className="border border-[#222] hover:border-[#39FF14] hover:text-[#39FF14] px-2 py-1 text-[11px] font-mono text-[#A0A0A0]"
                                        data-testid={`model-pick-${name}-${m}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    {results[name] && !results[name].ok && (
                        <div className="mt-3 text-xs font-mono text-red-400">
                            {results[name].error}
                        </div>
                    )}
                </div>
            ))}

            <div className="border border-[#222] bg-[#121212] p-5" data-testid="local-api-key-card">
                <div className="font-display text-lg font-bold uppercase tracking-tight text-[#EDEDED] mb-2">
                    Optional local API key
                </div>
                <div className="text-sm text-[#A0A0A0] mb-3">
                    If your self-hosted endpoint requires auth, add the bearer token here. Most local setups leave this
                    blank.
                </div>
                <input
                    type="password"
                    value={settings.localApiKey}
                    onChange={(e) => update({ localApiKey: e.target.value })}
                    placeholder="Bearer token (optional)"
                    className="w-full bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#39FF14]"
                    data-testid="local-api-key-input"
                />
            </div>
        </div>
    );
}
