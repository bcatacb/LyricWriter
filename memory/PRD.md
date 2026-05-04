# Lyricist — AI Lyricist & Digital Songbook

## Original Problem Statement
Build an AI app where the user uploads an MP3 instrumental, the AI analyzes it (BPM, key, mood, duration, energy) and then co-writes lyrics tailored to the track. Users provide theme, style (preset or custom), must-have words, and either define the song structure or let the AI decide. The system supports three lyric operations: **Generate** (from scratch), **Complete** (fill in partial lyrics), and **Polish** (review + rewrite finished lyrics). Once lyrics are approved they are archived alongside the audio file with full metadata and version history in a searchable digital songbook.

## User Choices (2026-05-04)
- **LLM providers**: Open-ended — cloud (Claude/GPT/Gemini via Emergent Universal Key) + local (Ollama, LM Studio, OpenAI-compatible endpoints configurable by user).
- **Audio analysis**: Python libraries (librosa) for BPM / key / duration / energy / heuristic mood. User has an RTX 3080 for future local audio-AI upgrades.
- **Storage**: Emergent-managed object storage for MP3s (Cloudflare R2 option deferred).
- **Primary DB**: MongoDB (Emergent platform default; PostgreSQL/pgvector/Pinecone deferred as future enhancement).
- **Auth**: None (single-user mode).
- **Design**: Electric neon-green on dark, DAW/cyberpunk aesthetic.

## Architecture
- **Backend**: FastAPI + Motor (MongoDB) + librosa + httpx + emergentintegrations + Emergent object storage.
- **Frontend**: React + Tailwind + shadcn/ui + wavesurfer.js + Phosphor icons, neon green (#39FF14) on void black (#0A0A0A). Typography: Unbounded (display) / IBM Plex Sans (body) / JetBrains Mono (data).

## Backend Endpoints (prefix `/api`)
- Songs: `POST /songs/upload`, `GET /songs`, `GET /songs/{id}`, `PATCH /songs/{id}`, `DELETE /songs/{id}`, `GET /songs/{id}/audio`
- Drafts: `POST /songs/{id}/drafts`, `GET /songs/{id}/drafts`, `POST /songs/{id}/drafts/{draft_id}/approve`, `DELETE /songs/{id}/drafts/{draft_id}`
- Styles: `GET /styles`, `POST /styles`, `DELETE /styles/{id}` (presets protected)
- Lyrics: `POST /lyrics/generate`, `POST /lyrics/complete`, `POST /lyrics/polish`
- Providers: `GET /providers`, `POST /providers/test`
- Stats: `GET /stats`

## Implemented Features
### 2026-05-04 (Initial MVP)
- Drag-and-drop MP3/WAV/OGG/FLAC/M4A upload with client-side validation + waveform preview.
- librosa-based audio analysis — BPM (beat_track), key (Krumhansl-Schmuckler chroma), duration, RMS energy, heuristic mood tag.
- Emergent object storage for MP3s with soft-delete and backend-streamed playback.
- Multi-provider LLM routing: Claude Sonnet/Haiku/Opus 4.5, GPT-5.x / 4.1, Gemini 3 via Emergent Universal Key; Ollama + LM Studio via OpenAI-compatible `/v1/chat/completions`.
- Three lyric operations with section-tag enforced prompt templates.
- Draft/version history per song with "Approve Final" archival.
- Styles library — 6 seeded presets + user-created custom styles.
- Songbook search/filter by keyword, mood, BPM range, tag.
- Provider settings with endpoint test (pings `/v1/models`).
- Neon-green DAW visual system (Unbounded + JetBrains Mono, grid background, waveform with neon playhead, section-tag highlighter).
- `data-testid` on all interactive elements.

### 2026-05-04 (Iteration 2)
- **Public Share Links** — POST /api/songs/{id}/drafts/{did}/share returns a unique slug; /share/:slug is a public page (no nav chrome) with waveform, analysis tags, neon-highlighted lyrics, and a viral "Turn your beat into bars" CTA. View counter + revoke support.
- **SSE streaming** for all three lyric ops — POST /api/lyrics/{generate|complete|polish}/stream emits text/event-stream events (status/delta/done). True token-level streaming for local Ollama/LM Studio; word-level trickle for cloud providers (uniform live-typing UX).
- **shadcn AlertDialog** replacing every `window.confirm` — destructive red confirm for song/style/draft deletes; deterministic for Playwright.

Test coverage: 100% backend (30/30 pytest) + 100% frontend.

## Prioritized Backlog
### P0 (none — MVP complete)

### P1 — Next experience upgrades
1. **Public share link** for an approved song (signed URL page with audio + lyrics + metadata) to aid artist promotion.
2. **Export** — download lyrics as PDF/TXT and full "session bundle" (MP3 + final lyrics + DNA JSON).
3. Replace `window.confirm` with shadcn `AlertDialog` for delete actions (flagged by testing agent).
4. Stream-based lyric generation (SSE) so users see lines appear in real time.
5. Rate limit `/api/lyrics/*` + input caps (must_have_words, structure length).

### P2 — Platform expansion
6. **Vector search** — pgvector or Pinecone over audio embeddings + lyric embeddings to find "vibe-similar" tracks.
7. Lyric diff viewer between draft versions.
8. Syllable/stress-aware prosody hints per line.
9. Suno-/Udio-compatible export (stylized section tags for singer models).
10. User auth (Emergent Google) once multi-user is needed; move data isolation to user_id.
11. FastAPI lifespan migration + background-tasks for heavy librosa analysis.

## Next Tasks on User Handoff
1. Collect feedback after user uploads a real instrumental on Windows.
2. Decide P1 item to prioritize first (share link vs. export vs. streaming generation).
3. Validate Ollama connectivity once backend runs on user's local machine.
