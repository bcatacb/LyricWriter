import React from "react";
import { CLOUD_PROVIDERS, LOCAL_PROVIDERS } from "../lib/api";
import { useSettings } from "../lib/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

export default function ProviderSelector() {
    const { settings, update, availableModels } = useSettings();

    const isLocal = settings.provider === "ollama" || settings.provider === "lmstudio";

    // Cloud models list (keyed by provider)
    const CLOUD_MODEL_MAP = {
        anthropic: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-5-20251101"],
        openai: ["gpt-5.2", "gpt-5.1", "gpt-5-mini", "gpt-4.1"],
        gemini: ["gemini-3.1-pro-preview", "gemini-3-flash-preview", "gemini-2.5-pro"],
    };
    const cloudModels = CLOUD_MODEL_MAP[settings.provider] || [];

    return (
        <div className="flex flex-col gap-2 w-full">
            {/* Provider selector */}
            <Select
                value={settings.provider}
                onValueChange={(v) => update({ provider: v })}
            >
                <SelectTrigger
                    className="bg-[#121212] border border-[#222] rounded-none focus:ring-1 focus:ring-[#39FF14] h-10 text-sm font-mono"
                    data-testid="provider-select-trigger"
                >
                    <SelectValue placeholder="Select provider..." />
                </SelectTrigger>
                <SelectContent className="bg-[#0A0A0A] border-[#222] rounded-none text-[#EDEDED] max-h-[280px]">
                    {CLOUD_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="rounded-none font-mono text-xs">
                            {p.label}
                        </SelectItem>
                    ))}
                    {LOCAL_PROVIDERS.map((p) => (
                        <SelectItem key={p.value} value={p.value} className="rounded-none font-mono text-xs">
                            {p.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {/* Model selector */}
            <div className="flex flex-col w-full">
                {isLocal ? (
                    availableModels.length > 0 ? (
                        <Select
                            value={settings.localModels[settings.provider] || ""}
                            onValueChange={(v) =>
                                update({
                                    localModels: {
                                        ...settings.localModels,
                                        [settings.provider]: v,
                                    },
                                })
                            }
                        >
                            <SelectTrigger
                                className="bg-[#121212] border border-[#222] rounded-none focus:ring-1 focus:ring-[#39FF14] h-10 text-sm font-mono"
                                data-testid="model-select-trigger"
                            >
                                <SelectValue placeholder="Choose a model..." />
                            </SelectTrigger>
                            <SelectContent className="bg-[#0A0A0A] border-[#222] rounded-none text-[#EDEDED] max-h-[280px]">
                                {availableModels.map((m) => (
                                    <SelectItem key={m} value={m} className="rounded-none font-mono text-xs">
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : (
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
                    )
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

            {/* Show endpoint for local providers */}
            {isLocal && (
                <div className="text-[10px] font-mono text-[#666] mt-1" data-testid="provider-local-endpoint-info">
                    <span className="text-[#39FF14]">{settings.endpoints[settings.provider]}</span>
                </div>
            )}
        </div>
    );
}
