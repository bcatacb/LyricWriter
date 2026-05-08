import React from "react";
import { CLOUD_PROVIDERS, LOCAL_PROVIDERS } from "../lib/api";
import { useSettings } from "../lib/settings";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

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
            {isLocal && (
                <div className="text-[10px] font-mono text-[#666] mt-1" data-testid="provider-local-endpoint-info">
                    <span className="text-[#39FF14]">{settings.endpoints[settings.provider]}</span>
                </div>
            )}
        </div>
    );
}
