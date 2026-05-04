import React from "react";
import { CLOUD_PROVIDERS, LOCAL_PROVIDERS } from "../lib/api";
import { useSettings } from "../lib/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export default function ProviderSelector({ compact = false }) {
    const { settings, update } = useSettings();

    const allProviderOptions = [
        ...CLOUD_PROVIDERS.map((p) => ({ id: p.id, label: p.label, local: false })),
        ...LOCAL_PROVIDERS.map((p) => ({ id: p.id, label: p.label, local: true })),
    ];

    const isLocal = settings.provider === "ollama" || settings.provider === "lmstudio";
    const cloudModels = CLOUD_PROVIDERS.find((p) => p.id === settings.provider)?.models || [];

    const onProvider = (val) => {
        const cloud = CLOUD_PROVIDERS.find((p) => p.id === val);
        if (cloud) {
            update({ provider: val, model: cloud.models[0] });
        } else {
            update({ provider: val });
        }
    };

    return (
        <div className="flex flex-col gap-2" data-testid="provider-selector">
            <label className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666]">
                LLM Provider
            </label>
            <div className={`grid ${compact ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-2`}>
                <Select value={settings.provider} onValueChange={onProvider}>
                    <SelectTrigger
                        className="bg-[#121212] border border-[#222] rounded-none focus:ring-1 focus:ring-[#39FF14] h-10 text-sm"
                        data-testid="provider-select-trigger"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0A0A0A] border-[#222] rounded-none text-[#EDEDED]">
                        <div className="px-2 py-1 text-[10px] font-mono tracking-widest uppercase text-[#666]">CLOUD</div>
                        {CLOUD_PROVIDERS.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="rounded-none">
                                {p.label}
                            </SelectItem>
                        ))}
                        <div className="px-2 py-1 text-[10px] font-mono tracking-widest uppercase text-[#666] border-t border-[#222] mt-1">LOCAL</div>
                        {LOCAL_PROVIDERS.map((p) => (
                            <SelectItem key={p.id} value={p.id} className="rounded-none">
                                {p.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {isLocal ? (
                    <input
                        className="bg-[#121212] border border-[#222] text-sm h-10 px-3 font-mono text-[#EDEDED] focus:outline-none focus:border-[#39FF14]"
                        placeholder="model name (e.g. llama3, qwen2.5)"
                        value={settings.localModels[settings.provider] || ""}
                        onChange={(e) =>
                            update({
                                localModels: {
                                    ...settings.localModels,
                                    [settings.provider]: e.target.value,
                                },
                            })
                        }
                        data-testid="provider-local-model-input"
                    />
                ) : (
                    <Select
                        value={settings.model}
                        onValueChange={(v) => update({ model: v })}
                    >
                        <SelectTrigger
                            className="bg-[#121212] border border-[#222] rounded-none focus:ring-1 focus:ring-[#39FF14] h-10 text-sm font-mono"
                            data-testid="model-select-trigger"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0A0A0A] border-[#222] rounded-none text-[#EDEDED] max-h-[280px]">
                            {cloudModels.map((m) => (
                                <SelectItem key={m} value={m} className="rounded-none font-mono text-xs">
                                    {m}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}
            </div>
            {isLocal && (
                <div className="text-[10px] font-mono text-[#666] mt-1" data-testid="provider-local-endpoint-info">
                    Endpoint: {settings.endpoints[settings.provider]} — change in Providers page
                </div>
            )}
        </div>
    );
}
