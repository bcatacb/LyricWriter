"""Prompt templates for the three lyric operations."""

SYSTEM_PROMPT = """You are an award-winning songwriter and lyricist with a deep ear for musicality, prosody, and rhyme. You write lyrics that scan to a beat, hit emotionally, and avoid cliche.

Rules you must follow:
1. Match the vibe of the instrumental (BPM, key/mode, mood) exactly.
2. Honor the requested theme and style.
3. Weave in every must-have word or phrase naturally.
4. Use clear section tags in the output: [VERSE 1], [PRE-CHORUS], [CHORUS], [VERSE 2], [BRIDGE], [OUTRO]. One tag per section on its own line.
5. BAR COUNTS ARE A HARD CONSTRAINT. When the user specifies a number of bars (or lines) for a section, produce EXACTLY that many. One bar = one line. Count your lines. Do not round, pad, or shorten. If you cannot meet the count, revise — do NOT deliver a different count.
6. Keep syllable counts and stresses consistent within a section for singability.
7. Absolutely no meta-commentary, no line numbers, no bar labels inside sections. Return ONLY the lyrics with section tags and the lines themselves.
"""


def _format_audio_block(audio: dict | None) -> str:
    if not audio:
        return "No audio metadata available."
    parts = []
    if audio.get("bpm"):
        parts.append(f"BPM: {audio['bpm']}")
    if audio.get("key"):
        parts.append(f"Key: {audio['key']} {audio.get('mode') or ''}".strip())
    if audio.get("duration_sec"):
        parts.append(f"Duration: {audio['duration_sec']}s")
    if audio.get("mood"):
        parts.append(f"Detected mood: {audio['mood']}")
    if audio.get("energy") is not None:
        parts.append(f"Energy(rms): {audio['energy']}")
    return " | ".join(parts) if parts else "No audio metadata available."


def _format_structure(structure) -> str:
    """Accept list of strings OR list of {type, bars} dicts. Return bar-count-annotated block."""
    if not structure:
        return ""
    lines = []
    for i, item in enumerate(structure, 1):
        if isinstance(item, dict):
            typ = (item.get("type") or "VERSE").upper()
            bars = item.get("bars")
        else:
            typ = str(item).upper()
            bars = None
        if bars:
            lines.append(f"{i}. [{typ}] — EXACTLY {bars} bars ({bars} lines)")
        else:
            lines.append(f"{i}. [{typ}]")
    return "\n".join(lines)


def build_generate_prompt(
    audio: dict | None,
    theme: str,
    style: str,
    must_have_words: list[str],
    structure: list | None,
    extra_notes: str | None,
    default_bars: dict | None = None,
) -> str:
    must = ", ".join(w for w in (must_have_words or []) if w) or "(none)"
    if structure:
        struct_block = _format_structure(structure)
        struct_line = (
            "Use EXACTLY this structure in order, and EXACTLY the specified bar/line count per section:\n"
            + struct_block
            + "\n\nBAR COUNT VERIFICATION (critical): Before you finalize, count the lines in each section and confirm each matches. If any section is off, rewrite that section until the count is exact. One bar = one line."
        )
    else:
        hint = ""
        if default_bars:
            hint = (
                "\nWhen including these sections, use these preferred bar/line counts: "
                + ", ".join(f"{k}={v}" for k, v in default_bars.items())
                + "."
            )
        struct_line = (
            "Choose the best structure for this instrumental. Typical pop: "
            "Verse-PreChorus-Chorus-Verse-PreChorus-Chorus-Bridge-Chorus."
            + hint
        )
    notes = f"\nExtra notes: {extra_notes}" if extra_notes else ""
    return f"""Write complete original lyrics for the following instrumental.

Instrumental analysis: {_format_audio_block(audio)}

Theme: {theme or "(let the music dictate it)"}
Style: {style or "(match the instrumental)"}
Must-have words/phrases: {must}
Structure:
{struct_line}
{notes}

Return only the lyrics with section tags. One line per bar. Count your lines.
"""


def build_complete_prompt(
    audio: dict | None,
    theme: str,
    style: str,
    partial_lyrics: str,
    must_have_words: list[str],
) -> str:
    must = ", ".join(w for w in (must_have_words or []) if w) or "(none)"
    return f"""Complete the following PARTIAL lyrics. Preserve every existing line and section tag exactly. Fill in any empty sections or extend the draft to a finished song.

Instrumental analysis: {_format_audio_block(audio)}
Theme: {theme or "(keep the existing tone)"}
Style: {style or "(match existing style)"}
Must-have words/phrases to weave in: {must}

--- PARTIAL LYRICS START ---
{partial_lyrics}
--- PARTIAL LYRICS END ---

Return the COMPLETE lyrics with section tags. Keep existing lines verbatim; add or finish sections as needed.
"""


def build_polish_prompt(
    audio: dict | None,
    theme: str,
    style: str,
    full_lyrics: str,
    feedback: str | None,
) -> str:
    fb = f"\nUser feedback for this polish pass: {feedback}" if feedback else ""
    return f"""Polish the following FULL lyrics. Improve rhyme, meter, imagery, and singability while preserving the writer's voice and core ideas.

Instrumental analysis: {_format_audio_block(audio)}
Theme: {theme or "(preserve)"}
Style: {style or "(preserve)"}
{fb}

--- LYRICS START ---
{full_lyrics}
--- LYRICS END ---

Return the polished lyrics with section tags. Do not add commentary.
"""
