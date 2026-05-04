"""Prompt templates for the three lyric operations."""

SYSTEM_PROMPT = """You are an award-winning songwriter and lyricist with a deep ear for musicality, prosody, and rhyme. You write lyrics that scan to a beat, hit emotionally, and avoid cliche.

Rules you must follow:
1. Match the vibe of the instrumental (BPM, key/mode, mood) exactly.
2. Honor the requested theme and style.
3. Weave in every must-have word or phrase naturally.
4. Use clear section tags in the output: [VERSE 1], [PRE-CHORUS], [CHORUS], [VERSE 2], [BRIDGE], [OUTRO]. One tag per section on its own line.
5. Keep syllable counts and stresses consistent within a section for singability.
6. Absolutely no meta-commentary. Return ONLY the lyrics with section tags.
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


def build_generate_prompt(
    audio: dict | None,
    theme: str,
    style: str,
    must_have_words: list[str],
    structure: list[str] | None,
    extra_notes: str | None,
) -> str:
    must = ", ".join(w for w in (must_have_words or []) if w) or "(none)"
    if structure:
        struct_line = "Use EXACTLY this structure in order: " + " → ".join(structure)
    else:
        struct_line = "Choose the best structure for this instrumental. Typical pop: Verse-PreChorus-Chorus-Verse-PreChorus-Chorus-Bridge-Chorus."
    notes = f"\nExtra notes: {extra_notes}" if extra_notes else ""
    return f"""Write complete original lyrics for the following instrumental.

Instrumental analysis: {_format_audio_block(audio)}

Theme: {theme or "(let the music dictate it)"}
Style: {style or "(match the instrumental)"}
Must-have words/phrases: {must}
Structure: {struct_line}
{notes}

Return only the lyrics with section tags.
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
