"""AI Lyricist & Digital Songbook — main FastAPI app."""
import os
import uuid
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import (
    FastAPI,
    APIRouter,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query,
    BackgroundTasks,
)
from fastapi.responses import Response, StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from pydantic import BaseModel, Field

from .storage import init_storage, put_object, get_object
from .audio_analyzer import analyze_file
from .llm_router import call_llm, probe_endpoint, CLOUD_MODELS
from .prompts import (
    SYSTEM_PROMPT,
    build_generate_prompt,
    build_complete_prompt,
    build_polish_prompt,
)
from .stream_router import stream_llm

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

APP_NAME = os.environ.get("APP_NAME", "lyricist")
MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ["DB_NAME"]

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="AI Lyricist")

# CORS setup (at the top to catch everything)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")

# ---------------- Models ----------------


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class AudioFeatures(BaseModel):
    bpm: Optional[float] = None
    key: Optional[str] = None
    mode: Optional[str] = None
    duration_sec: Optional[float] = None
    energy: Optional[float] = None
    mood: Optional[str] = None


class Song(BaseModel):
    id: str
    title: str
    original_filename: str
    storage_path: str
    content_type: str
    size: int
    audio: AudioFeatures = Field(default_factory=AudioFeatures)
    genre: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    notes: Optional[str] = None
    is_deleted: bool = False
    created_at: str
    updated_at: str


class SongUpdate(BaseModel):
    title: Optional[str] = None
    genre: Optional[str] = None
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    mood: Optional[str] = None


class Draft(BaseModel):
    id: str
    song_id: str
    version: int
    lyrics: str
    source: str  # 'generate' | 'complete' | 'polish' | 'manual'
    params: dict = Field(default_factory=dict)

class SystemSettings(BaseModel):
    lmstudio_endpoint: str = "https://desktop-pslrnct.tail763538.ts.net"
    ollama_endpoint: str = "http://localhost:11434"

@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"id": "global"})
    if not s:
        return {"lmstudio_endpoint": "https://desktop-pslrnct.tail763538.ts.net", "ollama_endpoint": "http://localhost:11434"}
    # Convert Mongo _id etc
    return {
        "lmstudio_endpoint": s.get("lmstudio_endpoint", "https://desktop-pslrnct.tail763538.ts.net"),
        "ollama_endpoint": s.get("ollama_endpoint", "http://localhost:11434")
    }

@api.post("/settings")
async def update_settings(s: SystemSettings):
    await db.settings.update_one(
        {"id": "global"},
        {"$set": s.model_dump()},
        upsert=True
    )
    return {"status": "ok"}

@api.get("/probe")
async def probe_llm(endpoint: str = Query(...)):
    return await probe_endpoint(endpoint)

@api.get("/ping")
async def ping():
    return {"status": "pong"}
    is_approved: bool = False
    created_at: str


class Style(BaseModel):
    id: str
    name: str
    description: str
    prompt_snippet: str
    tags: List[str] = Field(default_factory=list)
    is_preset: bool = False
    created_at: str


class StyleCreate(BaseModel):
    name: str
    description: str = ""
    prompt_snippet: str
    tags: List[str] = Field(default_factory=list)


class StructureSection(BaseModel):
    type: str
    bars: Optional[int] = None


class GenerateRequest(BaseModel):
    song_id: Optional[str] = None
    audio: Optional[AudioFeatures] = None
    theme: str = ""
    style: str = ""
    must_have_words: List[str] = Field(default_factory=list)
    # Accept either list[str] (legacy) or list[StructureSection-like dict]
    structure: Optional[List] = None
    default_bars: Optional[dict] = None
    extra_notes: Optional[str] = None
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-5-20250929"
    endpoint: Optional[str] = None
    api_key: Optional[str] = None


class CompleteRequest(BaseModel):
    song_id: Optional[str] = None
    audio: Optional[AudioFeatures] = None
    theme: str = ""
    style: str = ""
    partial_lyrics: str
    must_have_words: List[str] = Field(default_factory=list)
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-5-20250929"
    endpoint: Optional[str] = None
    api_key: Optional[str] = None


class PolishRequest(BaseModel):
    song_id: Optional[str] = None
    audio: Optional[AudioFeatures] = None
    theme: str = ""
    style: str = ""
    full_lyrics: str
    feedback: Optional[str] = None
    provider: str = "anthropic"
    model: str = "claude-sonnet-4-5-20250929"
    endpoint: Optional[str] = None
    api_key: Optional[str] = None


class DraftCreate(BaseModel):
    lyrics: str
    source: str = "manual"
    params: dict = Field(default_factory=dict)
    is_approved: bool = False


class ProbeRequest(BaseModel):
    endpoint: str
    api_key: Optional[str] = None


# ---------------- Startup ----------------

PRESET_STYLES = [
    {
        "name": "Pop Radio",
        "description": "Catchy, sing-along pop with a strong chorus hook.",
        "prompt_snippet": "Write in a contemporary pop radio style: bright, emotional, with a memorable chorus hook, direct language, internal rhyme, and a simple repeating motif.",
        "tags": ["pop", "hook", "radio"],
        "is_preset": True,
    },
    {
        "name": "Trap/Hip-Hop",
        "description": "Modern trap cadences, internal rhymes, swagger.",
        "prompt_snippet": "Write in a modern trap/hip-hop style: multisyllabic internal rhymes, triplet cadences, confident first-person voice, vivid concrete imagery, ad-lib friendly phrasing.",
        "tags": ["trap", "rap", "hiphop"],
        "is_preset": True,
    },
    {
        "name": "Indie Folk",
        "description": "Intimate, narrative, acoustic-leaning storytelling.",
        "prompt_snippet": "Write in an indie folk style: intimate first-person narrative, specific sensory detail, restrained rhyme, melancholic warmth.",
        "tags": ["indie", "folk", "acoustic"],
        "is_preset": True,
    },
    {
        "name": "Synthwave",
        "description": "Neon-lit, nostalgic 80s-inspired imagery.",
        "prompt_snippet": "Write in a synthwave / retrowave style: neon cityscapes, chrome, midnight highways, nostalgic longing, 80s film imagery, dreamy detachment.",
        "tags": ["synthwave", "retro", "80s"],
        "is_preset": True,
    },
    {
        "name": "Rock Anthem",
        "description": "Big, fist-in-the-air stadium energy.",
        "prompt_snippet": "Write in a rock anthem style: declarative first-person, shout-along chorus, defiance and rebellion, powerful monosyllabic hook words.",
        "tags": ["rock", "anthem", "stadium"],
        "is_preset": True,
    },
    {
        "name": "R&B Slow Burn",
        "description": "Sensual, melismatic, vulnerable.",
        "prompt_snippet": "Write in a contemporary R&B slow-burn style: sensual imagery, vulnerable confession, melismatic-friendly phrasing, smooth enjambment.",
        "tags": ["rnb", "soul", "slow"],
        "is_preset": True,
    },
]


@app.on_event("startup")
async def startup():
    try:
        init_storage()
    except Exception as e:
        logger.error("Storage init failed: %s", e)

    # seed preset styles once
    existing = await db.styles.count_documents({"is_preset": True})
    if existing == 0:
        docs = []
        for s in PRESET_STYLES:
            docs.append({
                "id": str(uuid.uuid4()),
                "created_at": now_iso(),
                **s,
            })
        if docs:
            await db.styles.insert_many(docs)
        logger.info("Seeded %d preset styles", len(docs))


@app.on_event("shutdown")
async def shutdown():
    client.close()


# ---------------- Songs ----------------


@api.get("/")
async def root():
    return {"app": "AI Lyricist", "status": "ok"}

async def background_analyze(song_id: str, file_path: str):
    """Background task to analyze audio from a file path, avoiding loading whole file into memory."""
    try:
        logger.info(f"Starting background analysis for {song_id} using {file_path}")
        results = analyze_file(file_path)
        await db.songs.update_one(
            {"id": song_id},
            {"$set": {"audio": results, "updated_at": now_iso()}}
        )
        logger.info(f"Analysis complete for {song_id}")
    except Exception as e:
        logger.error(f"Background analysis failed for {song_id}: {e}")

@api.post("/songs/upload", response_model=Song)
async def upload_song(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
):
    """Upload a song, stream it to disk, and trigger low‑memory background analysis."""
    if not file.filename:
        raise HTTPException(400, "filename required")

    # Generate IDs and paths
    song_id = str(uuid.uuid4())
    storage_path = f"songs/{song_id}/{file.filename}"
    content_type = file.content_type or "audio/mpeg"

    # Ensure local temporary directory exists
    import os
    tmp_dir = os.path.join(os.getcwd(), "tmp_uploads")
    os.makedirs(tmp_dir, exist_ok=True)
    local_file_path = os.path.join(tmp_dir, f"{song_id}_{file.filename}")

    # Stream upload to local disk in 1 MB chunks
    try:
        with open(local_file_path, "wb") as out_file:
            while True:
                chunk = await file.read(1024 * 1024)  # 1 MB
                if not chunk:
                    break
                out_file.write(chunk)
    except Exception as e:
        logger.exception("Failed to write upload to disk")
        raise HTTPException(502, f"Disk write failed: {e}") from e

    # Upload the full content to storage (S3/Local) using the same file
    try:
        with open(local_file_path, "rb") as f:
            await put_object(storage_path, f.read())
    except Exception as e:
        logger.exception("Storage upload failed")
        raise HTTPException(502, f"Storage upload failed: {e}") from e

    # Create song record (size is file size on disk)
    size = os.path.getsize(local_file_path)
    song = Song(
        id=song_id,
        title=title or file.filename.rsplit(".", 1)[0],
        original_filename=file.filename,
        storage_path=storage_path,
        content_type=content_type,
        size=size,
        created_at=now_iso(),
        updated_at=now_iso(),
    )
    await db.songs.insert_one(song.model_dump())

    # Trigger low‑memory analysis using the saved file path
    background_tasks.add_task(background_analyze, song_id, local_file_path)

    return song


@api.get("/songs", response_model=List[Song])
async def list_songs(
    q: Optional[str] = None,
    mood: Optional[str] = None,
    genre: Optional[str] = None,
    min_bpm: Optional[float] = None,
    max_bpm: Optional[float] = None,
    tag: Optional[str] = None,
    limit: int = Query(100, le=500),
):
    query: dict = {"is_deleted": False}
    if q:
        query["$or"] = [
            {"title": {"$regex": q, "$options": "i"}},
            {"notes": {"$regex": q, "$options": "i"}},
            {"original_filename": {"$regex": q, "$options": "i"}},
        ]
    if mood:
        query["audio.mood"] = mood
    if genre:
        query["genre"] = genre
    if tag:
        query["tags"] = tag
    if min_bpm is not None or max_bpm is not None:
        bpm_q: dict = {}
        if min_bpm is not None:
            bpm_q["$gte"] = min_bpm
        if max_bpm is not None:
            bpm_q["$lte"] = max_bpm
        query["audio.bpm"] = bpm_q
    cursor = db.songs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    out = []
    async for doc in cursor:
        out.append(Song(**doc))
    return out


@api.get("/songs/{song_id}", response_model=Song)
async def get_song(song_id: str):
    doc = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Song not found")
    return Song(**doc)


@api.patch("/songs/{song_id}", response_model=Song)
async def update_song(song_id: str, update: SongUpdate):
    doc = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Song not found")
    patch: dict = {}
    for field in ("title", "genre", "tags", "notes"):
        v = getattr(update, field)
        if v is not None:
            patch[field] = v
    if update.mood is not None:
        patch["audio.mood"] = update.mood
    if patch:
        patch["updated_at"] = now_iso()
        await db.songs.update_one({"id": song_id}, {"$set": patch})
    doc = await db.songs.find_one({"id": song_id}, {"_id": 0})
    return Song(**doc)


@api.delete("/songs/{song_id}")
async def delete_song(song_id: str):
    res = await db.songs.update_one(
        {"id": song_id}, {"$set": {"is_deleted": True, "updated_at": now_iso()}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Song not found")
    return {"ok": True}


@api.get("/songs/{song_id}/audio")
async def stream_audio(song_id: str):
    doc = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Song not found")
    try:
        data, ct = get_object(doc["storage_path"])
    except Exception as e:
        raise HTTPException(502, f"Storage fetch failed: {e}") from e
    return Response(content=data, media_type=doc.get("content_type") or ct)


# ---------------- Drafts ----------------


@api.post("/songs/{song_id}/drafts", response_model=Draft)
async def create_draft(song_id: str, payload: DraftCreate):
    song = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
    if not song:
        raise HTTPException(404, "Song not found")
    existing = await db.drafts.count_documents({"song_id": song_id})
    draft = {
        "id": str(uuid.uuid4()),
        "song_id": song_id,
        "version": existing + 1,
        "lyrics": payload.lyrics,
        "source": payload.source,
        "params": payload.params,
        "is_approved": payload.is_approved,
        "created_at": now_iso(),
    }
    await db.drafts.insert_one(draft)
    draft.pop("_id", None)
    return Draft(**draft)


@api.get("/songs/{song_id}/drafts", response_model=List[Draft])
async def list_drafts(song_id: str):
    cursor = (
        db.drafts.find({"song_id": song_id}, {"_id": 0})
        .sort("version", -1)
        .limit(200)
    )
    out = []
    async for d in cursor:
        out.append(Draft(**d))
    return out


@api.post("/songs/{song_id}/drafts/{draft_id}/approve", response_model=Draft)
async def approve_draft(song_id: str, draft_id: str):
    # unapprove all other drafts for the song, approve this one
    await db.drafts.update_many(
        {"song_id": song_id}, {"$set": {"is_approved": False}}
    )
    res = await db.drafts.update_one(
        {"id": draft_id, "song_id": song_id}, {"$set": {"is_approved": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Draft not found")
    d = await db.drafts.find_one({"id": draft_id}, {"_id": 0})
    return Draft(**d)


@api.delete("/songs/{song_id}/drafts/{draft_id}")
async def delete_draft(song_id: str, draft_id: str):
    res = await db.drafts.delete_one({"id": draft_id, "song_id": song_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Draft not found")
    return {"ok": True}


# ---------------- Styles ----------------


@api.get("/styles", response_model=List[Style])
async def list_styles():
    cursor = db.styles.find({}, {"_id": 0}).sort([("is_preset", -1), ("name", 1)])
    out = []
    async for s in cursor:
        out.append(Style(**s))
    return out


@api.post("/styles", response_model=Style)
async def create_style(payload: StyleCreate):
    doc = {
        "id": str(uuid.uuid4()),
        "created_at": now_iso(),
        "is_preset": False,
        **payload.model_dump(),
    }
    await db.styles.insert_one(doc)
    doc.pop("_id", None)
    return Style(**doc)


@api.delete("/styles/{style_id}")
async def delete_style(style_id: str):
    res = await db.styles.delete_one({"id": style_id, "is_preset": False})
    if res.deleted_count == 0:
        raise HTTPException(404, "Style not found or is a preset")
    return {"ok": True}


# ---------------- Providers ----------------


@api.get("/providers")
async def list_providers():
    return {
        "cloud": CLOUD_MODELS,
        "local": {
            "ollama": {
                "default_endpoint": "http://localhost:11434",
                "note": "Ollama's OpenAI-compatible API. /v1 is appended automatically.",
            },
            "lmstudio": {
                "default_endpoint": "http://localhost:1234/v1",
                "note": "LM Studio OpenAI-compatible server.",
            },
        },
    }


@api.post("/providers/test")
async def providers_test(req: ProbeRequest):
    result = await probe_endpoint(req.endpoint, req.api_key)
    return result


# ---------------- Lyrics ----------------


async def _resolve_audio(song_id: Optional[str], inline: Optional[AudioFeatures]):
    if inline:
        return inline.model_dump()
    if song_id:
        s = await db.songs.find_one({"id": song_id}, {"_id": 0})
        if s:
            return s.get("audio") or {}
    return {}


@api.post("/lyrics/generate")
async def lyrics_generate(req: GenerateRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_generate_prompt(
        audio, req.theme, req.style, req.must_have_words, req.structure,
        req.extra_notes, req.default_bars,
    )
    try:
        text = await call_llm(
            req.provider,
            req.model,
            SYSTEM_PROMPT,
            user_prompt,
            session_id=f"generate-{req.song_id or 'adhoc'}",
            endpoint=req.endpoint,
            api_key=req.api_key,
        )
    except Exception as e:
        logger.exception("Generate failed")
        raise HTTPException(502, f"LLM error: {e}") from e
    return {"lyrics": text, "provider": req.provider, "model": req.model}


@api.post("/lyrics/complete")
async def lyrics_complete(req: CompleteRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_complete_prompt(
        audio, req.theme, req.style, req.partial_lyrics, req.must_have_words
    )
    try:
        text = await call_llm(
            req.provider,
            req.model,
            SYSTEM_PROMPT,
            user_prompt,
            session_id=f"complete-{req.song_id or 'adhoc'}",
            endpoint=req.endpoint,
            api_key=req.api_key,
        )
    except Exception as e:
        logger.exception("Complete failed")
        raise HTTPException(502, f"LLM error: {e}") from e
    return {"lyrics": text, "provider": req.provider, "model": req.model}


@api.post("/lyrics/polish")
async def lyrics_polish(req: PolishRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_polish_prompt(
        audio, req.theme, req.style, req.full_lyrics, req.feedback
    )
    try:
        text = await call_llm(
            req.provider,
            req.model,
            SYSTEM_PROMPT,
            user_prompt,
            session_id=f"polish-{req.song_id or 'adhoc'}",
            endpoint=req.endpoint,
            api_key=req.api_key,
        )
    except Exception as e:
        logger.exception("Polish failed")
        raise HTTPException(502, f"LLM error: {e}") from e
    return {"lyrics": text, "provider": req.provider, "model": req.model}


# ---------------- Stats ----------------


@api.get("/stats")
async def stats():
    songs_count = await db.songs.count_documents({"is_deleted": False})
    drafts_count = await db.drafts.count_documents({})
    approved_count = await db.drafts.count_documents({"is_approved": True})
    return {
        "songs": songs_count,
        "drafts": drafts_count,
        "approved": approved_count,
    }


# ---------------- Streaming (SSE) ----------------


def _sse_stream(provider, model, system_prompt, user_prompt, session_id, endpoint, api_key):
    async def gen():
        async for chunk in stream_llm(
            provider=provider,
            model=model,
            system=system_prompt,
            user=user_prompt,
            session_id=session_id,
            endpoint=endpoint,
            api_key=api_key,
        ):
            yield chunk

    headers = {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(gen(), media_type="text/event-stream", headers=headers)


@api.post("/lyrics/generate/stream")
async def lyrics_generate_stream(req: GenerateRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_generate_prompt(
        audio, req.theme, req.style, req.must_have_words, req.structure,
        req.extra_notes, req.default_bars,
    )
    return _sse_stream(
        req.provider, req.model, SYSTEM_PROMPT, user_prompt,
        f"generate-{req.song_id or 'adhoc'}", req.endpoint, req.api_key,
    )


@api.post("/lyrics/complete/stream")
async def lyrics_complete_stream(req: CompleteRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_complete_prompt(
        audio, req.theme, req.style, req.partial_lyrics, req.must_have_words
    )
    return _sse_stream(
        req.provider, req.model, SYSTEM_PROMPT, user_prompt,
        f"complete-{req.song_id or 'adhoc'}", req.endpoint, req.api_key,
    )


@api.post("/lyrics/polish/stream")
async def lyrics_polish_stream(req: PolishRequest):
    audio = await _resolve_audio(req.song_id, req.audio)
    user_prompt = build_polish_prompt(
        audio, req.theme, req.style, req.full_lyrics, req.feedback
    )
    return _sse_stream(
        req.provider, req.model, SYSTEM_PROMPT, user_prompt,
        f"polish-{req.song_id or 'adhoc'}", req.endpoint, req.api_key,
    )


# ---------------- Public share links ----------------


def _make_slug(title: str) -> str:
    import re
    base = re.sub(r"[^a-z0-9]+", "-", (title or "song").lower()).strip("-")[:48]
    if not base:
        base = "song"
    return f"{base}-{uuid.uuid4().hex[:6]}"


class ShareCreateRequest(BaseModel):
    # (no fields needed; identified by path)
    pass


@api.post("/songs/{song_id}/drafts/{draft_id}/share")
async def create_share(song_id: str, draft_id: str):
    song = await db.songs.find_one({"id": song_id, "is_deleted": False}, {"_id": 0})
    if not song:
        raise HTTPException(404, "Song not found")
    draft = await db.drafts.find_one({"id": draft_id, "song_id": song_id}, {"_id": 0})
    if not draft:
        raise HTTPException(404, "Draft not found")

    # If a share already exists for this draft, return it (idempotent).
    existing = await db.shares.find_one(
        {"song_id": song_id, "draft_id": draft_id, "is_revoked": False}, {"_id": 0}
    )
    if existing:
        return existing

    slug = _make_slug(song.get("title", ""))
    doc = {
        "slug": slug,
        "song_id": song_id,
        "draft_id": draft_id,
        "is_revoked": False,
        "view_count": 0,
        "created_at": now_iso(),
    }
    await db.shares.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/shares/{slug}")
async def revoke_share(slug: str):
    res = await db.shares.update_one(
        {"slug": slug}, {"$set": {"is_revoked": True}}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Share not found")
    return {"ok": True}


@api.get("/songs/{song_id}/shares")
async def list_shares_for_song(song_id: str):
    cursor = db.shares.find(
        {"song_id": song_id, "is_revoked": False}, {"_id": 0}
    ).sort("created_at", -1)
    return [s async for s in cursor]


@api.get("/share/{slug}")
async def get_share(slug: str):
    share = await db.shares.find_one({"slug": slug, "is_revoked": False}, {"_id": 0})
    if not share:
        raise HTTPException(404, "Share not found or revoked")
    song = await db.songs.find_one(
        {"id": share["song_id"], "is_deleted": False}, {"_id": 0}
    )
    if not song:
        raise HTTPException(404, "Song not available")
    draft = await db.drafts.find_one({"id": share["draft_id"]}, {"_id": 0})
    if not draft:
        raise HTTPException(404, "Lyrics not available")
    await db.shares.update_one({"slug": slug}, {"$inc": {"view_count": 1}})
    return {
        "slug": slug,
        "created_at": share["created_at"],
        "view_count": share.get("view_count", 0) + 1,
        "song": {
            "id": song["id"],
            "title": song["title"],
            "original_filename": song["original_filename"],
            "audio": song.get("audio") or {},
            "genre": song.get("genre"),
            "tags": song.get("tags") or [],
        },
        "lyrics": draft["lyrics"],
        "draft_version": draft.get("version"),
        "theme": (draft.get("params") or {}).get("theme"),
        "style": (draft.get("params") or {}).get("style"),
    }


@api.get("/share/{slug}/audio")
async def share_audio(slug: str):
    share = await db.shares.find_one({"slug": slug, "is_revoked": False}, {"_id": 0})
    if not share:
        raise HTTPException(404, "Share not found")
    song = await db.songs.find_one(
        {"id": share["song_id"], "is_deleted": False}, {"_id": 0}
    )
    if not song:
        raise HTTPException(404, "Audio not available")
    try:
        data, ct = get_object(song["storage_path"])
    except Exception as e:
        raise HTTPException(502, f"Storage fetch failed: {e}") from e
    return Response(content=data, media_type=song.get("content_type") or ct)


@app.get("/healthz")
async def health_check():
    return {"status": "ok"}


app.include_router(api)
