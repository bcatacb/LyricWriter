import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { ShareNetworkIcon, CopyIcon, CheckIcon, TrashIcon } from "@phosphor-icons/react";
import { api, BACKEND_URL } from "../lib/api";
import { toast } from "sonner";

export default function ShareDialog({ open, onOpenChange, songId, draftId }) {
    const [share, setShare] = useState(null);
    const [busy, setBusy] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!open || !songId || !draftId) return;
        setShare(null);
        setBusy(true);
        api.post(`/songs/${songId}/drafts/${draftId}/share`)
            .then((r) => setShare(r.data))
            .catch((e) => toast.error("Could not create share link", { description: e?.response?.data?.detail || e.message }))
            .finally(() => setBusy(false));
    }, [open, songId, draftId]);

    const url = share ? `${window.location.origin}/share/${share.slug}` : "";

    const copy = async () => {
        if (!url) return;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            toast.success("Link copied");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Copy failed — select and copy manually");
        }
    };

    const revoke = async () => {
        if (!share) return;
        setBusy(true);
        try {
            await api.delete(`/shares/${share.slug}`);
            toast.success("Share link revoked");
            onOpenChange?.(false);
        } catch (e) {
            toast.error("Revoke failed");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="bg-[#121212] border border-[#222] rounded-none text-[#EDEDED] max-w-lg"
                data-testid="share-dialog"
            >
                <DialogHeader>
                    <DialogTitle className="font-display uppercase tracking-tight text-[#EDEDED] flex items-center gap-2">
                        <ShareNetworkIcon size={18} color="#39FF14" weight="bold" />
                        Share this Song
                    </DialogTitle>
                    <DialogDescription className="text-[#A0A0A0]">
                        Public page with waveform + lyrics. No login required to view.
                    </DialogDescription>
                </DialogHeader>

                {busy && !share ? (
                    <div className="py-8 text-center text-[#A0A0A0] font-mono text-sm">
                        Creating link…
                    </div>
                ) : share ? (
                    <div className="space-y-4">
                        <div className="border border-[#39FF14]/40 bg-[#0A0A0A] p-3 flex items-center gap-2">
                            <code
                                className="flex-1 font-mono text-xs text-[#39FF14] break-all"
                                data-testid="share-url"
                            >
                                {url}
                            </code>
                            <button
                                onClick={copy}
                                className="bg-[#39FF14] text-black font-mono text-xs uppercase tracking-widest px-3 py-2 hover:bg-[#00FF41] flex items-center gap-1"
                                data-testid="share-copy-btn"
                            >
                                {copied ? <CheckIcon size={12} weight="bold" /> : <CopyIcon size={12} weight="bold" />}
                                {copied ? "Copied" : "Copy"}
                            </button>
                        </div>

                        <div className="text-xs text-[#666] font-mono flex items-center justify-between">
                            <span>views · {share.view_count ?? 0}</span>
                            <span>created {new Date(share.created_at).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-[#222]">
                            <a
                                href={`/share/${share.slug}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-[#39FF14] font-mono text-xs uppercase tracking-[0.2em] border border-[#39FF14]/40 px-3 py-2 hover:bg-[#39FF14]/10"
                                data-testid="share-open-btn"
                            >
                                → Open Public Page
                            </a>
                            <button
                                onClick={revoke}
                                disabled={busy}
                                className="text-red-400 hover:text-red-300 font-mono text-xs uppercase tracking-[0.2em] border border-red-900/40 px-3 py-2 hover:bg-red-900/20 flex items-center gap-1"
                                data-testid="share-revoke-btn"
                            >
                                <TrashIcon size={12} /> Revoke
                            </button>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
