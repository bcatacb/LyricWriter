import React, { useRef, useState } from "react";
import { UploadSimpleIcon, MusicNoteIcon } from "@phosphor-icons/react";

export default function Dropzone({ onFile, busy }) {
    const inputRef = useRef(null);
    const [over, setOver] = useState(false);

    const pick = () => inputRef.current?.click();

    const handle = (f) => {
        if (!f) return;
        if (!/audio\/(mpeg|mp3|wav|ogg|flac|mp4|x-m4a)/.test(f.type) && !/\.(mp3|wav|ogg|flac|m4a)$/i.test(f.name)) {
            alert("Please upload an audio file (mp3, wav, ogg, flac, m4a)");
            return;
        }
        onFile?.(f);
    };

    return (
        <div
            className={[
                "relative border-2 border-dashed transition-colors",
                over ? "border-[#39FF14] bg-[#39FF14]/5" : "border-[#2a2a2a] bg-[#121212]",
                "px-6 py-12 flex flex-col items-center justify-center gap-4 cursor-pointer",
            ].join(" ")}
            onClick={pick}
            onDragOver={(e) => {
                e.preventDefault();
                setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setOver(false);
                const f = e.dataTransfer.files?.[0];
                handle(f);
            }}
            data-testid="dropzone"
        >
            <input
                ref={inputRef}
                type="file"
                accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
                className="hidden"
                onChange={(e) => handle(e.target.files?.[0])}
                data-testid="dropzone-input"
            />

            <div className="w-16 h-16 border border-[#39FF14]/40 flex items-center justify-center">
                {busy ? (
                    <div className="w-6 h-6 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                ) : (
                    <UploadSimpleIcon size={26} color="#39FF14" weight="bold" />
                )}
            </div>

            <div className="text-center">
                <div className="font-display text-xl uppercase tracking-tight text-[#EDEDED] font-bold">
                    {busy ? "Analyzing instrumental…" : "Drop your instrumental"}
                </div>
                <div className="mt-2 font-mono text-[10px] tracking-[0.3em] uppercase text-[#666]">
                    MP3 · WAV · OGG · FLAC · M4A · ≤ 30MB
                </div>
            </div>

            <div className="flex items-center gap-2 text-[#A0A0A0] text-sm">
                <MusicNoteIcon size={14} weight="fill" color="#39FF14" />
                <span>Drag &amp; drop or click to browse</span>
            </div>
        </div>
    );
}
