import React, { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, BACKEND_URL } from "../lib/api";
import Waveform from "../components/Waveform";
import AnalysisTags from "../components/AnalysisTags";
import LyricsDisplay from "../components/LyricsDisplay";
import { CircleDashedIcon, EyeIcon } from "@phosphor-icons/react";

export default function SharePage() {
    const { slug } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        api.get(`/share/${slug}`)
            .then((r) => setData(r.data))
            .catch((e) => setError(e?.response?.status === 404 ? "This share link was revoked or doesn't exist." : "Could not load this share."));
    }, [slug]);

    const audioUrl = useMemo(
        () => (slug ? `${BACKEND_URL}/api/share/${slug}/audio` : null),
        [slug]
    );

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center text-center p-8 bg-[#0A0A0A]" data-testid="share-error">
                <div>
                    <div className="font-mono text-xs text-[#666] uppercase tracking-widest mb-3">/share/invalid</div>
                    <div className="font-display text-3xl uppercase text-[#EDEDED]">Link unavailable</div>
                    <div className="text-[#A0A0A0] mt-2">{error}</div>
                    <Link to="/" className="inline-block mt-6 border border-[#39FF14] text-[#39FF14] font-mono text-xs uppercase tracking-[0.2em] px-4 py-2 hover:bg-[#39FF14]/10">
                        → Make your own
                    </Link>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
                <div className="font-mono text-xs text-[#666] uppercase tracking-widest animate-pulse">LOADING…</div>
            </div>
        );
    }

    const s = data.song;

    return (
        <div className="min-h-screen bg-[#0A0A0A] text-[#EDEDED]" data-testid="share-page">
            <div className="max-w-3xl mx-auto px-6 py-8">
                {/* Minimal branded header */}
                <Link to="/" className="inline-flex items-center gap-2 mb-8" data-testid="share-brand-link">
                    <div className="w-7 h-7 border border-[#39FF14] flex items-center justify-center">
                        <CircleDashedIcon size={16} color="#39FF14" weight="bold" />
                    </div>
                    <div>
                        <div className="font-display font-black text-sm uppercase tracking-tight leading-none">Lyricist</div>
                        <div className="font-mono text-[9px] tracking-[0.3em] text-[#666] uppercase">beat-to-bars engine</div>
                    </div>
                </Link>

                <div className="mb-6">
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#39FF14]">
                        /share/{data.slug}
                    </div>
                    <h1 className="font-display text-3xl sm:text-5xl font-black uppercase tracking-tight text-[#EDEDED] mt-2" data-testid="share-title">
                        {s.title}
                    </h1>
                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#666]">
                        <span className="flex items-center gap-1">
                            <EyeIcon size={12} /> {data.view_count} view{data.view_count === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span>v{data.draft_version}</span>
                        <span>·</span>
                        <span>{new Date(data.created_at).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="border border-[#222] bg-[#121212] p-5 mb-6">
                    <Waveform url={audioUrl} height={80} />
                    <AnalysisTags audio={s.audio} className="mt-4" />
                    {(data.theme || data.style || s.genre) && (
                        <div className="mt-4 text-xs font-mono text-[#A0A0A0] space-y-1">
                            {data.theme && <div><span className="text-[#666] uppercase tracking-widest mr-2">Theme</span>{data.theme}</div>}
                            {data.style && <div><span className="text-[#666] uppercase tracking-widest mr-2">Style</span><span className="italic">{data.style.slice(0, 160)}{data.style.length > 160 ? "…" : ""}</span></div>}
                            {s.genre && <div><span className="text-[#666] uppercase tracking-widest mr-2">Genre</span>{s.genre}</div>}
                        </div>
                    )}
                </div>

                <div className="border border-[#39FF14]/30 bg-[#0A0A0A] p-6 mb-10" data-testid="share-lyrics">
                    <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#39FF14] mb-3">Lyrics</div>
                    <LyricsDisplay text={data.lyrics} />
                </div>

                <div className="border-t border-[#222] pt-6 text-center">
                    <div className="text-xs font-mono text-[#666] uppercase tracking-widest mb-3">
                        made with lyricist
                    </div>
                    <Link
                        to="/"
                        className="inline-block bg-[#39FF14] text-black font-bold uppercase tracking-[0.15em] text-xs px-6 py-3 hover:bg-[#00FF41] shadow-[0_0_15px_rgba(57,255,20,0.25)]"
                        data-testid="share-cta-create"
                    >
                        Turn your beat into bars →
                    </Link>
                </div>
            </div>
        </div>
    );
}
