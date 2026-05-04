import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { PlayIcon, PauseIcon } from "@phosphor-icons/react";

export default function Waveform({ url, height = 96, small = false }) {
    const containerRef = useRef(null);
    const wsRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [dur, setDur] = useState(0);
    const [pos, setPos] = useState(0);

    useEffect(() => {
        if (!containerRef.current || !url) return;
        const ws = WaveSurfer.create({
            container: containerRef.current,
            waveColor: "#2a2a2a",
            progressColor: "#39FF14",
            cursorColor: "#EDEDED",
            cursorWidth: 2,
            barWidth: 2,
            barGap: 1,
            barRadius: 0,
            height,
            normalize: true,
        });
        wsRef.current = ws;
        ws.load(url);
        ws.on("ready", () => setDur(ws.getDuration()));
        ws.on("audioprocess", (t) => setPos(t));
        ws.on("seeking", (t) => setPos(t));
        ws.on("play", () => setPlaying(true));
        ws.on("pause", () => setPlaying(false));
        ws.on("finish", () => setPlaying(false));
        return () => {
            try { ws.destroy(); } catch {}
        };
    }, [url, height]);

    const fmt = (s) => {
        if (!s && s !== 0) return "--:--";
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${m}:${sec.toString().padStart(2, "0")}`;
    };

    return (
        <div
            className={`border border-[#222] bg-[#121212] ${small ? "p-2" : "p-4"}`}
            data-testid="waveform"
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="w-10 h-10 bg-[#39FF14] text-black flex items-center justify-center hover:bg-[#00FF41] transition-colors"
                    onClick={() => wsRef.current?.playPause()}
                    data-testid="waveform-play-pause"
                    aria-label={playing ? "Pause" : "Play"}
                >
                    {playing ? <PauseIcon size={16} weight="fill" /> : <PlayIcon size={16} weight="fill" />}
                </button>
                <div ref={containerRef} className="flex-1 cursor-pointer" />
                <div className="font-mono text-xs text-[#A0A0A0] tabular-nums min-w-[80px] text-right">
                    {fmt(pos)} / {fmt(dur)}
                </div>
            </div>
        </div>
    );
}
