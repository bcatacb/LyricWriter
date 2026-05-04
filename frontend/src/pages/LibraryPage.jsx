import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MagnifyingGlassIcon, VinylRecordIcon, TrashIcon } from "@phosphor-icons/react";
import { api } from "../lib/api";
import { toast } from "sonner";

const MOODS = ["energetic", "aggressive", "chill", "melancholic", "introspective", "mellow", "uplifting", "moody"];

export default function LibraryPage() {
    const [songs, setSongs] = useState([]);
    const [q, setQ] = useState("");
    const [mood, setMood] = useState("");
    const [minBpm, setMinBpm] = useState("");
    const [maxBpm, setMaxBpm] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchList = async () => {
        setLoading(true);
        try {
            const params = {};
            if (q) params.q = q;
            if (mood) params.mood = mood;
            if (minBpm) params.min_bpm = minBpm;
            if (maxBpm) params.max_bpm = maxBpm;
            const r = await api.get("/songs", { params });
            setSongs(r.data);
        } catch (e) {
            toast.error("Failed to load songs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchList(); /* eslint-disable-next-line */ }, []);
    useEffect(() => {
        const t = setTimeout(fetchList, 300);
        return () => clearTimeout(t);
        // eslint-disable-next-line
    }, [q, mood, minBpm, maxBpm]);

    const handleDelete = async (id, e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!window.confirm("Archive this track?")) return;
        try {
            await api.delete(`/songs/${id}`);
            toast.success("Archived");
            fetchList();
        } catch {
            toast.error("Delete failed");
        }
    };

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8" data-testid="library-page">
            <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#39FF14]">/songbook</div>
                    <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#EDEDED] mt-2">
                        The Digital Songbook
                    </h1>
                    <p className="text-[#A0A0A0] mt-2">
                        {songs.length} track{songs.length === 1 ? "" : "s"} archived · searchable by vibe.
                    </p>
                </div>
            </div>

            <div className="border border-[#222] bg-[#121212] p-4 grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
                <div className="relative md:col-span-2">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666]" size={14} />
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Search title, notes, filename…"
                        className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                        data-testid="library-search-input"
                    />
                </div>
                <select
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#39FF14]"
                    data-testid="library-mood-filter"
                >
                    <option value="">ALL MOODS</option>
                    {MOODS.map((m) => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                </select>
                <div className="flex gap-2">
                    <input
                        value={minBpm}
                        onChange={(e) => setMinBpm(e.target.value)}
                        type="number"
                        placeholder="min BPM"
                        className="w-1/2 bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#39FF14]"
                        data-testid="library-min-bpm"
                    />
                    <input
                        value={maxBpm}
                        onChange={(e) => setMaxBpm(e.target.value)}
                        type="number"
                        placeholder="max BPM"
                        className="w-1/2 bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm font-mono focus:outline-none focus:border-[#39FF14]"
                        data-testid="library-max-bpm"
                    />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-24 text-[#666] font-mono text-sm">LOADING…</div>
            ) : songs.length === 0 ? (
                <div className="border border-dashed border-[#222] p-16 flex flex-col items-center gap-4" data-testid="library-empty">
                    <VinylRecordIcon size={48} color="#333" weight="duotone" />
                    <div className="font-display text-xl uppercase text-[#A0A0A0]">No tracks yet</div>
                    <Link to="/" className="text-[#39FF14] font-mono text-xs tracking-[0.2em] uppercase border border-[#39FF14] px-4 py-2 hover:bg-[#39FF14]/10">
                        → Upload First Instrumental
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {songs.map((s) => (
                        <SongCard key={s.id} song={s} onDelete={handleDelete} />
                    ))}
                </div>
            )}
        </div>
    );
}

function SongCard({ song, onDelete }) {
    const bpm = song.audio?.bpm ? Math.round(song.audio.bpm) : null;
    const key = song.audio?.key ? `${song.audio.key} ${song.audio?.mode || ""}` : null;
    return (
        <Link
            to={`/song/${song.id}`}
            className="group border border-[#222] bg-[#121212] p-5 hover:border-[#39FF14] transition-colors block relative"
            data-testid={`song-card-${song.id}`}
        >
            <button
                onClick={(e) => onDelete(song.id, e)}
                className="absolute top-3 right-3 text-[#666] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`song-delete-${song.id}`}
                aria-label="Archive track"
            >
                <TrashIcon size={16} />
            </button>
            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#666] mb-2">
                {new Date(song.created_at).toLocaleDateString()}
            </div>
            <div className="font-display text-xl font-bold text-[#EDEDED] truncate pr-6">
                {song.title}
            </div>
            <div className="text-xs text-[#A0A0A0] mt-1 truncate font-mono">
                {song.original_filename}
            </div>
            <div className="flex flex-wrap gap-2 mt-4">
                {bpm && (
                    <span className="border border-[#222] px-2 py-1 text-[10px] font-mono text-[#39FF14]">
                        {bpm} BPM
                    </span>
                )}
                {key && (
                    <span className="border border-[#222] px-2 py-1 text-[10px] font-mono text-[#A0A0A0]">
                        {key}
                    </span>
                )}
                {song.audio?.mood && (
                    <span className="border border-[#222] px-2 py-1 text-[10px] font-mono text-[#A0A0A0] uppercase">
                        {song.audio.mood}
                    </span>
                )}
                {song.genre && (
                    <span className="border border-[#222] px-2 py-1 text-[10px] font-mono text-[#A0A0A0]">
                        {song.genre}
                    </span>
                )}
            </div>
        </Link>
    );
}
