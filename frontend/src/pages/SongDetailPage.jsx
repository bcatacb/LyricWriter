import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import {
    ArrowLeftIcon,
    CheckCircleIcon,
    TrashIcon,
    PencilSimpleIcon,
    ShareNetworkIcon,
} from "@phosphor-icons/react";
import { api, BACKEND_URL } from "../lib/api";
import Waveform from "../components/Waveform";
import AnalysisTags from "../components/AnalysisTags";
import LyricsDisplay from "../components/LyricsDisplay";
import ConfirmDialog from "../components/ConfirmDialog";
import ShareDialog from "../components/ShareDialog";

export default function SongDetailPage() {
    const { id } = useParams();
    const [song, setSong] = useState(null);
    const [drafts, setDrafts] = useState([]);
    const [selectedDraftId, setSelectedDraftId] = useState(null);
    const [editingMeta, setEditingMeta] = useState(false);
    const [meta, setMeta] = useState({ title: "", genre: "", tags: "", notes: "" });

    const [confirmDraftId, setConfirmDraftId] = useState(null);
    const [shareOpen, setShareOpen] = useState(false);

    const fetchAll = useCallback(async () => {
        try {
            const [s, d] = await Promise.all([
                api.get(`/songs/${id}`),
                api.get(`/songs/${id}/drafts`),
            ]);
            setSong(s.data);
            setDrafts(d.data);
            setMeta({
                title: s.data.title || "",
                genre: s.data.genre || "",
                tags: (s.data.tags || []).join(", "),
                notes: s.data.notes || "",
            });
            if (d.data.length > 0) {
                const approved = d.data.find((x) => x.is_approved);
                setSelectedDraftId((prev) => prev && d.data.find((x) => x.id === prev) ? prev : (approved?.id || d.data[0].id));
            }
        } catch (e) {
            toast.error("Failed to load song");
        }
    }, [id]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const audioUrl = useMemo(() => (song ? `${BACKEND_URL}/api/songs/${song.id}/audio` : null), [song]);
    const selectedDraft = drafts.find((d) => d.id === selectedDraftId);

    const saveMeta = async () => {
        try {
            const r = await api.patch(`/songs/${id}`, {
                title: meta.title,
                genre: meta.genre || null,
                tags: meta.tags.split(",").map((s) => s.trim()).filter(Boolean),
                notes: meta.notes || null,
            });
            setSong(r.data);
            setEditingMeta(false);
            toast.success("Saved");
        } catch {
            toast.error("Failed");
        }
    };

    const approveDraft = async (draftId) => {
        try {
            await api.post(`/songs/${id}/drafts/${draftId}/approve`);
            toast.success("Marked as final");
            fetchAll();
        } catch {
            toast.error("Failed");
        }
    };

    const deleteDraft = async (draftId) => {
        try {
            await api.delete(`/songs/${id}/drafts/${draftId}`);
            toast.success("Draft deleted");
            setConfirmDraftId(null);
            if (selectedDraftId === draftId) setSelectedDraftId(null);
            fetchAll();
        } catch {
            toast.error("Failed");
        }
    };

    if (!song) return <div className="max-w-4xl mx-auto p-8 text-[#A0A0A0]">Loading…</div>;

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8" data-testid="song-detail-page">
            <Link to="/library" className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-[0.2em] text-[#A0A0A0] hover:text-[#39FF14] mb-4" data-testid="back-to-library">
                <ArrowLeftIcon size={12} /> Back to Songbook
            </Link>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
                <div className="space-y-6">
                    <div className="border border-[#222] bg-[#121212] p-5">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <div className="flex-1">
                                {editingMeta ? (
                                    <input
                                        value={meta.title}
                                        onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                                        className="bg-transparent border-b border-[#39FF14] text-2xl font-display font-bold text-[#EDEDED] w-full focus:outline-none"
                                        data-testid="edit-title-input"
                                    />
                                ) : (
                                    <h1 className="font-display text-3xl font-black uppercase tracking-tight text-[#EDEDED]" data-testid="song-title">
                                        {song.title}
                                    </h1>
                                )}
                                <div className="text-xs font-mono text-[#666] mt-1">
                                    {song.original_filename} · added {new Date(song.created_at).toLocaleString()}
                                </div>
                            </div>
                            <button
                                onClick={() => (editingMeta ? saveMeta() : setEditingMeta(true))}
                                className="border border-[#222] hover:border-[#39FF14] hover:text-[#39FF14] px-3 py-2 text-xs font-mono uppercase tracking-[0.2em] text-[#A0A0A0] flex items-center gap-2"
                                data-testid="edit-meta-btn"
                            >
                                <PencilSimpleIcon size={12} /> {editingMeta ? "Save" : "Edit"}
                            </button>
                        </div>

                        <Waveform url={audioUrl} />
                        <AnalysisTags audio={song.audio} className="mt-4" />

                        {editingMeta ? (
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                                <input value={meta.genre} onChange={(e) => setMeta({ ...meta, genre: e.target.value })} placeholder="Genre" className="bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]" data-testid="edit-genre-input" />
                                <input value={meta.tags} onChange={(e) => setMeta({ ...meta, tags: e.target.value })} placeholder="Tags (comma separated)" className="bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]" data-testid="edit-tags-input" />
                                <textarea value={meta.notes} onChange={(e) => setMeta({ ...meta, notes: e.target.value })} placeholder="Private notes" rows={2} className="md:col-span-2 bg-[#0A0A0A] border border-[#222] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14] resize-none" data-testid="edit-notes-input" />
                            </div>
                        ) : (
                            (song.genre || (song.tags || []).length > 0 || song.notes) && (
                                <div className="mt-4 text-sm text-[#A0A0A0] space-y-2">
                                    {song.genre && <div><span className="text-[#666] font-mono uppercase text-xs tracking-widest mr-2">Genre</span>{song.genre}</div>}
                                    {(song.tags || []).length > 0 && (
                                        <div className="flex gap-2 flex-wrap">
                                            {song.tags.map((t) => (
                                                <span key={t} className="border border-[#222] px-2 py-1 text-[10px] font-mono uppercase text-[#A0A0A0]">#{t}</span>
                                            ))}
                                        </div>
                                    )}
                                    {song.notes && <div className="italic text-[#A0A0A0]">{song.notes}</div>}
                                </div>
                            )
                        )}
                    </div>

                    <div className="border border-[#222] bg-[#121212] p-5">
                        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                            <div className="font-display text-lg font-bold text-[#39FF14] uppercase tracking-tight">
                                {selectedDraft?.is_approved ? "Final Lyrics" : "Draft"}
                                {selectedDraft && (
                                    <span className="ml-3 font-mono text-xs text-[#666] normal-case tracking-widest">
                                        v{selectedDraft.version} · {selectedDraft.source}
                                    </span>
                                )}
                            </div>
                            {selectedDraft && (
                                <div className="flex items-center gap-2 flex-wrap">
                                    {!selectedDraft.is_approved && (
                                        <button
                                            onClick={() => approveDraft(selectedDraft.id)}
                                            className="bg-[#39FF14] text-black text-xs font-mono uppercase tracking-[0.2em] px-3 py-2 hover:bg-[#00FF41] flex items-center gap-2"
                                            data-testid="approve-draft-btn"
                                        >
                                            <CheckCircleIcon size={12} weight="fill" /> Approve
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setShareOpen(true)}
                                        className="border border-[#39FF14] text-[#39FF14] bg-transparent hover:bg-[#39FF14]/10 text-xs font-mono uppercase tracking-[0.2em] px-3 py-2 flex items-center gap-2"
                                        data-testid="share-draft-btn"
                                    >
                                        <ShareNetworkIcon size={12} weight="bold" /> Share
                                    </button>
                                </div>
                            )}
                        </div>
                        {selectedDraft ? (
                            <LyricsDisplay text={selectedDraft.lyrics} />
                        ) : (
                            <div className="text-[#666] text-center py-12 font-mono text-sm">
                                No lyrics yet — head back to Studio to create.
                            </div>
                        )}
                    </div>
                </div>

                <div className="border border-[#222] bg-[#121212] p-5" data-testid="drafts-list">
                    <div className="font-display text-lg font-bold text-[#39FF14] uppercase tracking-tight mb-4">
                        Version History
                    </div>
                    {drafts.length === 0 ? (
                        <div className="text-[#666] text-sm font-mono">No drafts yet.</div>
                    ) : (
                        <div className="space-y-2">
                            {drafts.map((d) => (
                                <button
                                    key={d.id}
                                    onClick={() => setSelectedDraftId(d.id)}
                                    className={[
                                        "w-full text-left border p-3 transition-colors",
                                        selectedDraftId === d.id ? "border-[#39FF14] bg-[#39FF14]/5" : "border-[#222] hover:border-[#444]",
                                    ].join(" ")}
                                    data-testid={`draft-item-${d.id}`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <div className="font-mono text-xs text-[#EDEDED]">
                                                v{d.version}
                                                {d.is_approved && <span className="ml-2 text-[#39FF14]">★ FINAL</span>}
                                            </div>
                                            <div className="font-mono text-[10px] text-[#666] uppercase tracking-widest mt-0.5">
                                                {d.source} · {new Date(d.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <span
                                            onClick={(e) => { e.stopPropagation(); setConfirmDraftId(d.id); }}
                                            className="text-[#666] hover:text-red-400 p-1 cursor-pointer"
                                            data-testid={`draft-delete-${d.id}`}
                                        >
                                            <TrashIcon size={12} />
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-[#A0A0A0] mt-2 line-clamp-2 font-normal">
                                        {d.lyrics.slice(0, 120).replace(/\n/g, " ")}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={!!confirmDraftId}
                onOpenChange={(v) => !v && setConfirmDraftId(null)}
                title="Delete this draft?"
                description="This permanently removes this version from history."
                confirmLabel="Delete"
                destructive
                onConfirm={() => confirmDraftId && deleteDraft(confirmDraftId)}
                testIdPrefix="confirm-draft-delete"
            />

            <ShareDialog
                open={shareOpen}
                onOpenChange={setShareOpen}
                songId={song.id}
                draftId={selectedDraft?.id}
            />
        </div>
    );
}
