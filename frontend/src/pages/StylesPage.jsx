import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { TrashIcon, PlusIcon, StarIcon } from "@phosphor-icons/react";
import { api } from "../lib/api";
import ConfirmDialog from "../components/ConfirmDialog";

export default function StylesPage() {
    const [styles, setStyles] = useState([]);
    const [form, setForm] = useState({ name: "", description: "", prompt_snippet: "", tags: "" });
    const [busy, setBusy] = useState(false);
    const [confirmId, setConfirmId] = useState(null);

    const load = () => api.get("/styles").then((r) => setStyles(r.data));

    useEffect(() => { load(); }, []);

    const create = async (e) => {
        e.preventDefault();
        if (!form.name.trim() || !form.prompt_snippet.trim()) return toast.error("Name and prompt snippet required");
        setBusy(true);
        try {
            await api.post("/styles", {
                name: form.name,
                description: form.description,
                prompt_snippet: form.prompt_snippet,
                tags: form.tags.split(",").map((s) => s.trim()).filter(Boolean),
            });
            toast.success("Style saved");
            setForm({ name: "", description: "", prompt_snippet: "", tags: "" });
            load();
        } catch (e) {
            toast.error("Failed to save");
        } finally {
            setBusy(false);
        }
    };

    const remove = async (id) => {
        try {
            await api.delete(`/styles/${id}`);
            toast.success("Deleted");
            setConfirmId(null);
            load();
        } catch {
            toast.error("Failed");
        }
    };

    return (
        <div className="max-w-[1400px] mx-auto px-6 py-8" data-testid="styles-page">
            <div className="mb-6">
                <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#39FF14]">/styles</div>
                <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#EDEDED] mt-2">
                    Style Presets
                </h1>
                <p className="text-[#A0A0A0] mt-2">
                    Pre-loaded genre voices + your custom saved styles. Click one in the Studio to apply it instantly.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                <div className="space-y-3" data-testid="styles-list">
                    {styles.map((s) => (
                        <div key={s.id} className="border border-[#222] bg-[#121212] p-4" data-testid={`style-row-${s.id}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="font-display text-lg font-bold text-[#EDEDED]">{s.name}</div>
                                        {s.is_preset && (
                                            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-widest text-[#39FF14] border border-[#39FF14]/30 px-1.5 py-0.5">
                                                <StarIcon size={10} weight="fill" /> PRESET
                                            </span>
                                        )}
                                    </div>
                                    {s.description && <div className="text-sm text-[#A0A0A0] mt-1">{s.description}</div>}
                                    <div className="text-xs text-[#666] mt-2 italic line-clamp-2">"{s.prompt_snippet}"</div>
                                    {(s.tags || []).length > 0 && (
                                        <div className="flex gap-2 mt-2 flex-wrap">
                                            {s.tags.map((t) => (
                                                <span key={t} className="border border-[#222] px-2 py-0.5 text-[10px] font-mono uppercase text-[#A0A0A0]">#{t}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {!s.is_preset && (
                                    <button
                                        onClick={() => setConfirmId(s.id)}
                                        className="text-[#666] hover:text-red-400"
                                        data-testid={`style-delete-${s.id}`}
                                        aria-label="Delete style"
                                    >
                                        <TrashIcon size={16} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <form onSubmit={create} className="border border-[#222] bg-[#121212] p-5 space-y-3 h-fit" data-testid="style-create-form">
                    <div className="font-display text-lg font-bold text-[#39FF14] uppercase tracking-tight">
                        Create Custom Style
                    </div>
                    <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Name (e.g. Dark Cabaret)"
                        className="w-full bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                        data-testid="style-name-input"
                    />
                    <input
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Short description"
                        className="w-full bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                        data-testid="style-description-input"
                    />
                    <textarea
                        value={form.prompt_snippet}
                        onChange={(e) => setForm({ ...form, prompt_snippet: e.target.value })}
                        placeholder="Prompt snippet — e.g. Write in a dark cabaret style: theatrical, sinister, metaphor-heavy..."
                        rows={4}
                        className="w-full bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14] resize-none"
                        data-testid="style-snippet-input"
                    />
                    <input
                        value={form.tags}
                        onChange={(e) => setForm({ ...form, tags: e.target.value })}
                        placeholder="tags, comma separated"
                        className="w-full bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                        data-testid="style-tags-input"
                    />
                    <button
                        type="submit"
                        disabled={busy}
                        className="w-full bg-[#39FF14] text-black font-bold uppercase tracking-[0.2em] text-xs px-4 py-3 hover:bg-[#00FF41] disabled:opacity-60 flex items-center justify-center gap-2"
                        data-testid="style-create-btn"
                    >
                        <PlusIcon size={12} weight="bold" /> {busy ? "Saving…" : "Save Style"}
                    </button>
                </form>
            </div>

            <ConfirmDialog
                open={!!confirmId}
                onOpenChange={(v) => !v && setConfirmId(null)}
                title="Delete this style?"
                description="You won't be able to recover it."
                confirmLabel="Delete"
                destructive
                onConfirm={() => confirmId && remove(confirmId)}
                testIdPrefix="confirm-style-delete"
            />
        </div>
    );
}
