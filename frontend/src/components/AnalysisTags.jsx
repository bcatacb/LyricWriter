import React from "react";

function Tag({ label, value, testid }) {
    return (
        <div
            className="border border-[#222] bg-[#121212] px-3 py-2 flex flex-col gap-0.5"
            data-testid={testid}
        >
            <span className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#666]">
                {label}
            </span>
            <span className="font-mono text-[#39FF14] text-sm font-semibold">
                {value ?? "—"}
            </span>
        </div>
    );
}

export default function AnalysisTags({ audio, className = "" }) {
    const bpm = audio?.bpm != null ? `${Math.round(audio.bpm)}` : null;
    const key = audio?.key ? `${audio.key} ${audio?.mode || ""}`.trim() : null;
    const dur = audio?.duration_sec
        ? (() => {
              const s = Math.round(audio.duration_sec);
              const m = Math.floor(s / 60);
              return `${m}:${(s % 60).toString().padStart(2, "0")}`;
          })()
        : null;
    const energy =
        audio?.energy != null ? Number(audio.energy).toFixed(3) : null;

    return (
        <div
            className={`grid grid-cols-2 sm:grid-cols-5 gap-2 ${className}`}
            data-testid="analysis-tags"
        >
            <Tag label="BPM" value={bpm} testid="tag-bpm" />
            <Tag label="KEY" value={key} testid="tag-key" />
            <Tag label="LENGTH" value={dur} testid="tag-duration" />
            <Tag label="ENERGY" value={energy} testid="tag-energy" />
            <Tag label="MOOD" value={audio?.mood} testid="tag-mood" />
        </div>
    );
}
