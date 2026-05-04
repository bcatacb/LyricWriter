"""Librosa-based audio analysis: BPM, key, duration, energy, simple mood tag."""
import io
import logging
import numpy as np
import librosa

logger = logging.getLogger(__name__)

# Krumhansl-Schmuckler key profiles
_MAJOR_PROFILE = np.array(
    [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88]
)
_MINOR_PROFILE = np.array(
    [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
)
_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]


def _detect_key(y: np.ndarray, sr: int) -> tuple[str, str]:
    """Return (note, mode) like ('C', 'major')."""
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_avg = chroma.mean(axis=1)
    # normalize
    chroma_avg = chroma_avg / (chroma_avg.sum() + 1e-9)

    best_score = -1.0
    best = ("C", "major")
    for i in range(12):
        rotated = np.roll(chroma_avg, -i)
        maj = float(np.corrcoef(rotated, _MAJOR_PROFILE)[0, 1])
        minr = float(np.corrcoef(rotated, _MINOR_PROFILE)[0, 1])
        if maj > best_score:
            best_score = maj
            best = (_NOTES[i], "major")
        if minr > best_score:
            best_score = minr
            best = (_NOTES[i], "minor")
    return best


def _infer_mood(bpm: float, energy: float, mode: str) -> str:
    """Cheap heuristic mood label."""
    if energy > 0.08 and bpm >= 120:
        return "energetic" if mode == "major" else "aggressive"
    if bpm < 80 and energy < 0.04:
        return "melancholic" if mode == "minor" else "chill"
    if bpm < 100:
        return "introspective" if mode == "minor" else "mellow"
    return "uplifting" if mode == "major" else "moody"


def analyze_audio(data: bytes) -> dict:
    """Analyze raw audio bytes. Returns dict with bpm, key, mode, duration_sec, energy, mood."""
    try:
        # librosa.load expects a filelike or path; BytesIO works for most formats via soundfile/audioread
        y, sr = librosa.load(io.BytesIO(data), sr=22050, mono=True, duration=120.0)
    except Exception as e:
        logger.exception("librosa load failed: %s", e)
        return {
            "bpm": None,
            "key": None,
            "mode": None,
            "duration_sec": None,
            "energy": None,
            "mood": None,
            "error": str(e),
        }

    duration = float(librosa.get_duration(y=y, sr=sr))

    try:
        tempo, _ = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(np.asarray(tempo).flatten()[0])
    except Exception:
        bpm = 0.0

    try:
        note, mode = _detect_key(y, sr)
    except Exception:
        note, mode = "C", "major"

    try:
        rms = librosa.feature.rms(y=y)
        energy = float(np.mean(rms))
    except Exception:
        energy = 0.0

    mood = _infer_mood(bpm, energy, mode)

    return {
        "bpm": round(bpm, 1) if bpm else None,
        "key": note,
        "mode": mode,
        "duration_sec": round(duration, 2),
        "energy": round(energy, 4),
        "mood": mood,
    }
