import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
    SparkleIcon,
    FloppyDiskIcon,
    PencilSimpleIcon,
    MagicWandIcon,
    PlusIcon,
    XIcon,
    ArrowsClockwiseIcon,
} from "@phosphor-icons/react";

import { api, BACKEND_URL, API } from "../lib/api";
import { useSettings } from "../lib/settings";
import { streamSSE } from "../lib/sse";
import Dropzone from "../components/Dropzone";
import Waveform from "../components/Waveform";
import AnalysisTags from "../components/AnalysisTags";
import ProviderSelector from "../components/ProviderSelector";
import LyricsDisplay from "../components/LyricsDisplay";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Textarea } from "../components/ui/textarea";

const DEFAULT_BARS = {
    "VERSE": 16,
    "VERSE 1": 16,
    "VERSE 2": 16,
    "PRE-CHORUS": 4,
    "CHORUS": 8,
    "BRIDGE": 8,
    "HOOK": 8,
    "OUTRO": 4,
    "INTRO": 4,
};

const DEFAULT_SECTIONS = [
    { type: "VERSE 1", bars: 16 },
    { type: "PRE-CHORUS", bars: 4 },
    { type: "CHORUS", bars: 8 },
    { type: "VERSE 2", bars: 16 },
    { type: "CHORUS", bars: 8 },
    { type: "BRIDGE", bars: 8 },
    { type: "CHORUS", bars: 8 },
];
const SECTION_PALETTE = ["VERSE", "PRE-CHORUS", "CHORUS", "BRIDGE", "HOOK", "OUTRO", "INTRO"];

export default function StudioPage() {
    const navigate = useNavigate();
    const { settings, update, resolveForRequest } = useSettings();

    const [song, setSong] = useState(null);
    const [uploading, setUploading] = useState(false);

    const [theme, setTheme] = useState("");
    const [styleText, setStyleText] = useState("");
    const [mustHave, setMustHave] = useState("");
    const [notes, setNotes] = useState("");
    const [autoStructure, setAutoStructure] = useState(true);
    const [structure, setStructure] = useState(DEFAULT_SECTIONS);
    const [defaultBars, setDefaultBars] = useState({ VERSE: 16, CHORUS: 8, BRIDGE: 8, "PRE-CHORUS": 4 });

    const [styles, setStyles] = useState([]);
    const [lyrics, setLyrics] = useState("");
    const [busyAction, setBusyAction] = useState(null); // 'generate' | 'complete' | 'polish'
    const [mode, setMode] = useState("generate");
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        api.get("/styles").then((r) => setStyles(r.data)).catch(() => {});
    }, []);

    const audioUrl = useMemo(
        () => (song ? `${BACKEND_URL}/api/songs/${song.id}/audio` : null),
        [song]
    );

    const handleUpload = async (file) => {
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("title", file.name.replace(/\.[^.]+$/, ""));
            const r = await api.post("/songs/upload", fd, {
                headers: { "Content-Type": "multipart/form-data" },
                timeout: 240000,
            });
            
            const initialSong = r.data;
            setSong(initialSong);
            setLyrics("");

            // If analysis is still pending, start polling
            if (!initialSong.audio?.bpm) {
                toast.info("Upload complete", { description: "Analyzing audio in background..." });
                
                const interval = setInterval(async () => {
                    try {
                        const res = await api.get(`/songs/${initialSong.id}`);
                        if (res.data.audio?.bpm) {
                            setSong(res.data);
                            clearInterval(interval);
                            toast.success("Analysis complete", {
                                description: `${Math.round(res.data.audio.bpm)} BPM · ${res.data.audio.key} ${res.data.audio.mode}`,
                            });
                        }
                    } catch (e) {
                        console.error("Polling failed", e);
                        clearInterval(interval);
                    }
                }, 3000);
            } else {
                toast.success("Instrumental analyzed", {
                    description: `${Math.round(initialSong.audio.bpm)} BPM · ${initialSong.audio.key} ${initialSong.audio.mode}`,
                });
            }
        } catch (e) {
            console.error(e);
            toast.error("Upload failed", { description: e?.response?.data?.detail || e.message });
        } finally {
            setUploading(false);
        }
    };

    const buildBody = (extra = {}) => ({
        song_id: song?.id,
        theme,
        style: styleText,
        must_have_words: mustHave.split(",").map((s) => s.trim()).filter(Boolean),
        ...resolveForRequest(),
        ...extra,
    });

    const runGenerate = async () => {
        if (!song) return toast.error("Upload an instrumental first");
        setBusyAction("generate");
        setLyrics("");
        try {
            const body = buildBody({
                structure: autoStructure ? null : structure,
                default_bars: autoStructure ? defaultBars : null,
                extra_notes: notes,
            });
            await streamSSE(`${API}/lyrics/generate/stream`, body, {
                onEvent: ({ event, data }) => {
                    if (event === "delta") setLyrics((t) => t + (data?.text || ""));
                    if (event === "error") toast.error("Generation failed", { description: data?.message });
                    if (event === "done") {
                        if (data?.lyrics) setLyrics(data.lyrics);
                        toast.success("Lyrics generated");
                    }
                },
            });
        } catch (e) {
            toast.error("Generation failed", { description: e.message });
        } finally {
            setBusyAction(null);
        }
    };

    const runComplete = async () => {
        if (!song) return toast.error("Upload an instrumental first");
        if (!lyrics.trim()) return toast.error("Write some partial lyrics first");
        setBusyAction("complete");
        const seed = lyrics;
        try {
            const body = buildBody({ partial_lyrics: seed });
            let acc = "";
            await streamSSE(`${API}/lyrics/complete/stream`, body, {
                onEvent: ({ event, data }) => {
                    if (event === "delta") {
                        acc += data?.text || "";
                        setLyrics(acc);
                    }
                    if (event === "error") toast.error("Completion failed", { description: data?.message });
                    if (event === "done") {
                        if (data?.lyrics) setLyrics(data.lyrics);
                        toast.success("Lyrics completed");
                    }
                },
            });
        } catch (e) {
            toast.error("Completion failed", { description: e.message });
        } finally {
            setBusyAction(null);
        }
    };

    const runPolish = async () => {
        if (!song) return toast.error("Upload an instrumental first");
        if (!lyrics.trim()) return toast.error("Paste full lyrics to polish");
        setBusyAction("polish");
        const original = lyrics;
        try {
            const body = buildBody({ full_lyrics: original, feedback });
            let acc = "";
            await streamSSE(`${API}/lyrics/polish/stream`, body, {
                onEvent: ({ event, data }) => {
                    if (event === "delta") {
                        acc += data?.text || "";
                        setLyrics(acc);
                    }
                    if (event === "error") toast.error("Polish failed", { description: data?.message });
                    if (event === "done") {
                        if (data?.lyrics) setLyrics(data.lyrics);
                        toast.success("Lyrics polished");
                    }
                },
            });
        } catch (e) {
            toast.error("Polish failed", { description: e.message });
        } finally {
            setBusyAction(null);
        }
    };

    const saveDraft = async (approve = false) => {
        if (!song) return;
        if (!lyrics.trim()) return toast.error("Nothing to save");
        try {
            await api.post(`/songs/${song.id}/drafts`, {
                lyrics,
                source: mode,
                params: {
                    theme,
                    style: styleText,
                    must_have_words: mustHave,
                    structure: autoStructure ? null : structure,
                    ...resolveForRequest(),
                },
                is_approved: approve,
            });
            toast.success(approve ? "Final version archived" : "Draft saved");
            if (approve) navigate(`/song/${song.id}`);
        } catch (e) {
            toast.error("Save failed", { description: e?.response?.data?.detail || e.message });
        }
    };

    const insertSection = (section) => {
        const tag = `\n[${section}]\n`;
        setLyrics((t) => (t ? t.trimEnd() + tag : tag.trimStart()));
    };

    const moveStructure = (i, dir) => {
        const j = i + dir;
        if (j < 0 || j >= structure.length) return;
        const next = [...structure];
        [next[i], next[j]] = [next[j], next[i]];
        setStructure(next);
    };

    const setSectionType = (i, newType) => {
        const next = [...structure];
        // auto-update bars to default for the new type if user hadn't customized much
        next[i] = { type: newType, bars: DEFAULT_BARS[newType] ?? next[i].bars ?? 8 };
        setStructure(next);
    };

    const setSectionBars = (i, value) => {
        const n = parseInt(value, 10);
        const next = [...structure];
        next[i] = { ...next[i], bars: Number.isFinite(n) && n > 0 ? n : null };
        setStructure(next);
    };

    const totalBars = structure.reduce((s, x) => s + (x.bars || 0), 0);

    return (
        <div className="max-w-[1600px] mx-auto px-6 py-8" data-testid="studio-page">
            <div className="mb-8">
                <div className="font-mono text-xs tracking-[0.3em] uppercase text-[#39FF14]">
                    /studio/new-session
                </div>
                <h1 className="font-display text-4xl sm:text-5xl font-black uppercase tracking-tight text-[#EDEDED] mt-2">
                    Feed the Beat.<br />
                    <span className="text-[#39FF14]">Summon the Bars.</span>
                </h1>
                <p className="mt-3 text-[#A0A0A0] max-w-2xl">
                    Drop an instrumental and we'll measure its pulse, key, and mood — then co-write lyrics with any
                    cloud or local LLM you bring to the console.
                </p>
            </div>

            {!song && (
                <div className="grid-bg p-1 border border-[#222]">
                    <Dropzone onFile={handleUpload} busy={uploading} />
                </div>
            )}

            {song && (
                <div className="space-y-6">
                    <div className="border border-[#222] bg-[#121212] p-5">
                        <div className="flex items-start justify-between mb-4 gap-4">
                            <div>
                                <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#666]">LOADED TRACK</div>
                                <div className="font-display text-xl font-bold text-[#EDEDED] mt-1" data-testid="loaded-track-title">
                                    {song.title}
                                </div>
                                <div className="text-xs font-mono text-[#A0A0A0] mt-0.5">{song.original_filename}</div>
                            </div>
                            <button
                                onClick={() => { setSong(null); setLyrics(""); }}
                                className="text-xs font-mono uppercase tracking-widest text-[#666] hover:text-[#EDEDED] flex items-center gap-1"
                                data-testid="swap-track-btn"
                            >
                                <ArrowsClockwiseIcon size={12} /> Swap Track
                            </button>
                        </div>
                        <Waveform url={audioUrl} />
                        <AnalysisTags audio={song.audio} className="mt-4" />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                        {/* LEFT: Editor */}
                        <div className="border border-[#222] bg-[#121212] p-5 space-y-4">
                            <Tabs value={mode} onValueChange={setMode} data-testid="mode-tabs">
                                <TabsList className="bg-[#0A0A0A] border border-[#222] rounded-none p-0 h-auto">
                                    <TabsTrigger value="generate" className="rounded-none font-mono text-xs tracking-[0.2em] uppercase data-[state=active]:bg-[#39FF14] data-[state=active]:text-black" data-testid="mode-tab-generate">
                                        <SparkleIcon size={12} className="mr-2" /> Generate
                                    </TabsTrigger>
                                    <TabsTrigger value="complete" className="rounded-none font-mono text-xs tracking-[0.2em] uppercase data-[state=active]:bg-[#39FF14] data-[state=active]:text-black" data-testid="mode-tab-complete">
                                        <PencilSimpleIcon size={12} className="mr-2" /> Complete
                                    </TabsTrigger>
                                    <TabsTrigger value="polish" className="rounded-none font-mono text-xs tracking-[0.2em] uppercase data-[state=active]:bg-[#39FF14] data-[state=active]:text-black" data-testid="mode-tab-polish">
                                        <MagicWandIcon size={12} className="mr-2" /> Polish
                                    </TabsTrigger>
                                </TabsList>

                                <TabsContent value="generate" className="pt-4 space-y-3">
                                    <div className="text-[#A0A0A0] text-sm">
                                        Describe the song's heartbeat. The AI will write it from scratch.
                                    </div>
                                    <button
                                        onClick={runGenerate}
                                        disabled={busyAction === "generate"}
                                        className="bg-[#39FF14] text-black font-bold uppercase tracking-[0.15em] text-sm px-6 py-3 hover:bg-[#00FF41] disabled:opacity-60 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(57,255,20,0.25)] flex items-center gap-2"
                                        data-testid="generate-btn"
                                    >
                                        {busyAction === "generate" ? (
                                            <>
                                                <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                                Summoning…
                                            </>
                                        ) : (
                                            <>
                                                <SparkleIcon size={14} weight="fill" /> Generate Lyrics
                                            </>
                                        )}
                                    </button>
                                </TabsContent>
                                <TabsContent value="complete" className="pt-4 space-y-3">
                                    <div className="text-[#A0A0A0] text-sm">
                                        Write a few lines below, the AI continues in your voice.
                                    </div>
                                    <button
                                        onClick={runComplete}
                                        disabled={busyAction === "complete"}
                                        className="bg-[#39FF14] text-black font-bold uppercase tracking-[0.15em] text-sm px-6 py-3 hover:bg-[#00FF41] disabled:opacity-60 flex items-center gap-2"
                                        data-testid="complete-btn"
                                    >
                                        {busyAction === "complete" ? "Completing…" : (<><PencilSimpleIcon size={14} /> Complete Lyrics</>)}
                                    </button>
                                </TabsContent>
                                <TabsContent value="polish" className="pt-4 space-y-3">
                                    <div className="text-[#A0A0A0] text-sm">
                                        Paste full lyrics. AI will rework rhyme, meter, and imagery.
                                    </div>
                                    <input
                                        value={feedback}
                                        onChange={(e) => setFeedback(e.target.value)}
                                        placeholder="Optional: what to improve? (e.g. tighten the chorus)"
                                        className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                                        data-testid="polish-feedback-input"
                                    />
                                    <button
                                        onClick={runPolish}
                                        disabled={busyAction === "polish"}
                                        className="bg-[#39FF14] text-black font-bold uppercase tracking-[0.15em] text-sm px-6 py-3 hover:bg-[#00FF41] disabled:opacity-60 flex items-center gap-2"
                                        data-testid="polish-btn"
                                    >
                                        {busyAction === "polish" ? "Polishing…" : (<><MagicWandIcon size={14} /> Polish Lyrics</>)}
                                    </button>
                                </TabsContent>
                            </Tabs>

                            {/* Section inserter */}
                            <div className="border-t border-[#222] pt-4">
                                <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666] mb-2">
                                    Insert Section Tag
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {SECTION_PALETTE.map((s) => (
                                        <button
                                            key={s}
                                            onClick={() => insertSection(s)}
                                            className="border border-[#222] hover:border-[#39FF14] hover:text-[#39FF14] px-2 py-1 text-[10px] font-mono tracking-[0.15em] uppercase text-[#A0A0A0] transition-colors"
                                            data-testid={`insert-section-${s.toLowerCase().replace(/\s|-/g, "_")}`}
                                        >
                                            [{s}]
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666]">
                                        Lyric Sheet
                                    </div>
                                    <div className="text-[10px] font-mono text-[#666]">
                                        {lyrics.split("\n").length} lines · {lyrics.trim().split(/\s+/).filter(Boolean).length} words
                                    </div>
                                </div>
                                <Textarea
                                    value={lyrics}
                                    onChange={(e) => setLyrics(e.target.value)}
                                    rows={20}
                                    placeholder={mode === "generate"
                                        ? "Hit Generate to fill this canvas. Or start writing yourself."
                                        : mode === "complete"
                                        ? "Write a few seed lines or a partial verse, then Complete."
                                        : "Paste finished lyrics here, then Polish."}
                                    className="lyrics-editor w-full bg-[#0A0A0A] border border-[#222] rounded-none text-[#EDEDED] p-4 focus:border-[#39FF14] focus-visible:ring-0 min-h-[420px]"
                                    data-testid="lyrics-textarea"
                                />
                            </div>

                            {lyrics && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-[#222]">
                                    <button
                                        onClick={() => saveDraft(false)}
                                        className="border border-[#39FF14] text-[#39FF14] bg-transparent hover:bg-[#39FF14]/10 px-4 py-2 text-xs font-mono tracking-[0.2em] uppercase flex items-center gap-2"
                                        data-testid="save-draft-btn"
                                    >
                                        <FloppyDiskIcon size={12} /> Save Draft
                                    </button>
                                    <button
                                        onClick={() => saveDraft(true)}
                                        className="bg-[#39FF14] text-black font-bold px-4 py-2 text-xs font-mono tracking-[0.2em] uppercase hover:bg-[#00FF41] flex items-center gap-2"
                                        data-testid="approve-final-btn"
                                    >
                                        ✓ Approve Final
                                    </button>
                                    <button
                                        onClick={() => setLyrics("")}
                                        className="text-[#666] hover:text-[#EDEDED] px-4 py-2 text-xs font-mono tracking-[0.2em] uppercase"
                                        data-testid="clear-lyrics-btn"
                                    >
                                        Clear
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* RIGHT: Controls */}
                        <div className="space-y-4">
                            <div className="border border-[#222] bg-[#121212] p-5 space-y-4">
                                <div className="font-display text-lg font-bold text-[#39FF14] uppercase tracking-tight">
                                    Control Room
                                </div>
                                <div className="space-y-3">
                                    <ProviderSelector />
                                    {(settings.provider === "ollama" || settings.provider === "lmstudio") && (
                                        <div className="space-y-1">
                                            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666]">
                                                Local Endpoint
                                            </div>
                                            <input
                                                value={settings.endpoints[settings.provider]}
                                                onChange={(e) => update({
                                                    endpoints: {
                                                        ...settings.endpoints,
                                                        [settings.provider]: e.target.value
                                                    }
                                                })}
                                                placeholder="e.g. https://my-tunnel.ngrok-free.app"
                                                className="w-full bg-[#0A0A0A] border border-[#222] text-[#39FF14] px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#39FF14]"
                                            />
                                        </div>
                                    )}
                                </div>

                                <Field label="Theme / Subject">
                                    <input
                                        value={theme}
                                        onChange={(e) => setTheme(e.target.value)}
                                        placeholder="e.g. losing a best friend to distance"
                                        className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                                        data-testid="theme-input"
                                    />
                                </Field>

                                <Field label="Style">
                                    <div className="space-y-2">
                                        <input
                                            value={styleText}
                                            onChange={(e) => setStyleText(e.target.value)}
                                            placeholder="Custom style text..."
                                            className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                                            data-testid="style-input"
                                        />
                                        <div className="flex flex-wrap gap-1">
                                            {styles.map((s) => (
                                                <button
                                                    key={s.id}
                                                    type="button"
                                                    onClick={() => setStyleText(s.prompt_snippet)}
                                                    className="border border-[#222] hover:border-[#39FF14] hover:text-[#39FF14] text-[10px] font-mono tracking-[0.15em] uppercase text-[#A0A0A0] px-2 py-1 transition-colors"
                                                    data-testid={`style-preset-${s.name.toLowerCase().replace(/\s+/g, "-")}`}
                                                >
                                                    {s.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </Field>

                                <Field label="Must-have words/phrases (comma-separated)">
                                    <input
                                        value={mustHave}
                                        onChange={(e) => setMustHave(e.target.value)}
                                        placeholder="e.g. neon, midnight, never again"
                                        className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14]"
                                        data-testid="must-have-input"
                                    />
                                </Field>

                                <Field label="Extra Notes (optional)">
                                    <textarea
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        rows={2}
                                        placeholder="Anything else the AI should know…"
                                        className="w-full bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-3 py-2 text-sm focus:outline-none focus:border-[#39FF14] resize-none"
                                        data-testid="notes-input"
                                    />
                                </Field>
                            </div>

                            <div className="border border-[#222] bg-[#121212] p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="font-display text-lg font-bold text-[#39FF14] uppercase tracking-tight">
                                        Structure
                                    </div>
                                    <label className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-[#A0A0A0] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={autoStructure}
                                            onChange={(e) => setAutoStructure(e.target.checked)}
                                            className="accent-[#39FF14]"
                                            data-testid="auto-structure-toggle"
                                        />
                                        Let AI decide
                                    </label>
                                </div>

                                {!autoStructure && (
                                    <div className="space-y-2" data-testid="structure-builder">
                                        <div className="grid grid-cols-[1.5rem_1fr_auto_auto_auto_auto] gap-2 text-[9px] font-mono tracking-[0.2em] uppercase text-[#666] px-1">
                                            <span />
                                            <span>Section</span>
                                            <span className="text-right min-w-[70px]">Bars</span>
                                            <span />
                                            <span />
                                            <span />
                                        </div>
                                        {structure.map((sec, i) => (
                                            <div key={i} className="grid grid-cols-[1.5rem_1fr_auto_auto_auto_auto] items-center gap-2">
                                                <span className="font-mono text-xs text-[#666]">{String(i + 1).padStart(2, "0")}</span>
                                                <select
                                                    value={sec.type}
                                                    onChange={(e) => setSectionType(i, e.target.value)}
                                                    className="bg-[#0A0A0A] border border-[#222] text-[#EDEDED] px-2 py-1 text-xs font-mono focus:outline-none focus:border-[#39FF14]"
                                                    data-testid={`structure-select-${i}`}
                                                >
                                                    {SECTION_PALETTE.map((s) => (
                                                        <option key={s} value={s}>{s}</option>
                                                    ))}
                                                    {!SECTION_PALETTE.includes(sec.type) && (
                                                        <option value={sec.type}>{sec.type}</option>
                                                    )}
                                                </select>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    max={64}
                                                    value={sec.bars ?? ""}
                                                    onChange={(e) => setSectionBars(i, e.target.value)}
                                                    className="w-16 bg-[#0A0A0A] border border-[#222] text-[#39FF14] px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-[#39FF14]"
                                                    data-testid={`structure-bars-${i}`}
                                                    aria-label="bars"
                                                />
                                                <button onClick={() => moveStructure(i, -1)} className="text-[#666] hover:text-[#39FF14] px-1" data-testid={`structure-up-${i}`} aria-label="move up">▲</button>
                                                <button onClick={() => moveStructure(i, 1)} className="text-[#666] hover:text-[#39FF14] px-1" data-testid={`structure-down-${i}`} aria-label="move down">▼</button>
                                                <button onClick={() => setStructure(structure.filter((_, j) => j !== i))} className="text-[#666] hover:text-red-400 px-1" data-testid={`structure-remove-${i}`} aria-label="remove">
                                                    <XIcon size={12} />
                                                </button>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setStructure([...structure, { type: "VERSE", bars: 16 }])}
                                            className="w-full border border-dashed border-[#333] text-[#666] hover:text-[#39FF14] hover:border-[#39FF14] py-2 text-xs font-mono uppercase tracking-widest flex items-center justify-center gap-1"
                                            data-testid="structure-add-btn"
                                        >
                                            <PlusIcon size={12} /> Add Section
                                        </button>
                                        <div className="flex items-center justify-between pt-2 mt-2 border-t border-[#222] text-[10px] font-mono tracking-[0.2em] uppercase">
                                            <span className="text-[#666]">Total</span>
                                            <span className="text-[#39FF14]" data-testid="structure-total-bars">
                                                {totalBars} bars / {totalBars} lines
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {autoStructure && (
                                    <div className="space-y-2 pt-1" data-testid="default-bars-editor">
                                        <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666]">
                                            Preferred bars per section (when AI picks the structure)
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {["VERSE", "CHORUS", "PRE-CHORUS", "BRIDGE"].map((k) => (
                                                <label key={k} className="flex items-center justify-between bg-[#0A0A0A] border border-[#222] px-2 py-1.5 text-xs">
                                                    <span className="font-mono text-[#A0A0A0] uppercase tracking-widest text-[10px]">{k}</span>
                                                    <input
                                                        type="number"
                                                        min={1}
                                                        max={64}
                                                        value={defaultBars[k] ?? ""}
                                                        onChange={(e) => {
                                                            const n = parseInt(e.target.value, 10);
                                                            setDefaultBars({ ...defaultBars, [k]: Number.isFinite(n) && n > 0 ? n : null });
                                                        }}
                                                        className="w-14 bg-transparent border-b border-[#222] text-[#39FF14] text-right font-mono focus:outline-none focus:border-[#39FF14]"
                                                        data-testid={`default-bars-${k.toLowerCase().replace(/[^a-z]/g, "-")}`}
                                                    />
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {lyrics && (
                        <div className="border border-[#39FF14]/30 bg-[#0A0A0A] p-6" data-testid="lyrics-preview">
                            <div className="font-mono text-[10px] tracking-[0.3em] uppercase text-[#39FF14] mb-3">
                                Preview
                            </div>
                            <LyricsDisplay text={lyrics} />
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function Field({ label, children }) {
    return (
        <div>
            <div className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666] mb-1.5">
                {label}
            </div>
            {children}
        </div>
    );
}
