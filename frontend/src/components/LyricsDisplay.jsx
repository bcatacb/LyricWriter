import React, { useMemo } from "react";

// Renders read-only lyrics with section tags highlighted.
export default function LyricsDisplay({ text, className = "" }) {
    const parts = useMemo(() => {
        if (!text) return [];
        // Split into lines; wrap [SECTION] lines with a span class
        return text.split("\n").map((line, idx) => {
            const trimmed = line.trim();
            const isTag = /^\[[^\]]+\]$/.test(trimmed);
            return { idx, line, isTag };
        });
    }, [text]);

    if (!text) return null;

    return (
        <div
            className={`lyrics-display font-body text-[#EDEDED] leading-[1.9] whitespace-pre-wrap ${className}`}
            data-testid="lyrics-display"
        >
            {parts.map(({ idx, line, isTag }) => (
                <div key={idx} className={isTag ? "mt-4 mb-1" : ""}>
                    {isTag ? <span className="section-tag">{line}</span> : line || "\u00A0"}
                </div>
            ))}
        </div>
    );
}
