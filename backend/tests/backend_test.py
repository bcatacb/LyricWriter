"""Backend tests for AI Lyricist."""
import os
import time
import pytest
import requests

# Use FastAPI TestClient for local testing
API = "/api"


# Path to the small WAV generated before running tests
WAV_PATH = "tmp/test.wav"


@pytest.fixture(scope="session")
def client():
    from backend.server import app
    from fastapi.testclient import TestClient
    return TestClient(app)


@pytest.fixture(scope="session")
def uploaded_song(client):
    with open(WAV_PATH, "rb") as fh:
        files = {"file": ("test.wav", fh, "audio/wav")}
        data = {"title": "TEST_Song"}
        r = client.post(f"{API}/songs/upload", files=files, data=data, timeout=120)
    assert r.status_code == 200, f"upload failed: {r.status_code} {r.text}"
    return r.json()


# --- Root & providers ---
class TestBasics:
    def test_root(self, client):
        r = client.get(f"{API}/", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert d.get("app") == "AI Lyricist"
        assert d.get("status") == "ok"

    def test_providers(self, client):
        r = client.get(f"{API}/providers", timeout=30)
        assert r.status_code == 200
        d = r.json()
        assert "cloud" in d and "local" in d
        # Check cloud keys
        assert "anthropic" in d["cloud"]
        assert "openai" in d["cloud"]
        assert "gemini" in d["cloud"]
        # Local
        assert "ollama" in d["local"]
        assert "lmstudio" in d["local"]

    def test_stats(self, client):
        r = client.get(f"{API}/stats", timeout=30)
        assert r.status_code == 200
        d = r.json()
        for k in ("songs", "drafts", "approved"):
            assert k in d
            assert isinstance(d[k], int)


# --- Styles ---
class TestStyles:
    def test_list_presets(self, client):
        r = client.get(f"{API}/styles", timeout=30)
        assert r.status_code == 200
        styles = r.json()
        presets = [s for s in styles if s.get("is_preset")]
        assert len(presets) >= 6, f"expected >=6 presets, got {len(presets)}"

    def test_create_and_delete_custom(self, client):
        payload = {
            "name": "TEST_CustomStyle",
            "description": "test",
            "prompt_snippet": "Write in a test style.",
            "tags": ["test"],
        }
        r = client.post(f"{API}/styles", json=payload, timeout=30)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_CustomStyle"
        assert created["is_preset"] is False
        sid = created["id"]

        # verify persistence
        r2 = client.get(f"{API}/styles", timeout=30)
        ids = [s["id"] for s in r2.json()]
        assert sid in ids

        # delete
        rd = client.delete(f"{API}/styles/{sid}", timeout=30)
        assert rd.status_code == 200
        assert rd.json().get("ok") is True

        # Re-delete: should 404
        rd2 = client.delete(f"{API}/styles/{sid}", timeout=30)
        assert rd2.status_code == 404

    def test_cannot_delete_preset(self, client):
        r = client.get(f"{API}/styles", timeout=30)
        presets = [s for s in r.json() if s.get("is_preset")]
        assert presets, "no preset styles to test"
        pid = presets[0]["id"]
        rd = client.delete(f"{API}/styles/{pid}", timeout=30)
        assert rd.status_code == 404


# --- Songs CRUD ---
class TestSongs:
    def test_upload_and_analysis(self, uploaded_song):
        s = uploaded_song
        assert "id" in s
        assert s["title"] == "TEST_Song"
        a = s.get("audio") or {}
        # Analysis should populate these
        assert a.get("duration_sec") is not None
        assert a.get("duration_sec") > 0
        # Others may be present (best-effort)
        # At least one audio feature beyond duration
        feats = [a.get(k) for k in ("bpm", "key", "mode", "energy", "mood")]
        assert any(v is not None for v in feats), f"no features detected: {a}"

    def test_get_song(self, client, uploaded_song):
        sid = uploaded_song["id"]
        r = client.get(f"{API}/songs/{sid}", timeout=30)
        assert r.status_code == 200
        assert r.json()["id"] == sid

    def test_list_songs_contains(self, client, uploaded_song):
        r = client.get(f"{API}/songs", timeout=30)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert uploaded_song["id"] in ids

    def test_list_songs_filters(self, client, uploaded_song):
        # filter by title
        r = client.get(f"{API}/songs?q=TEST_Song", timeout=30)
        assert r.status_code == 200
        ids = [s["id"] for s in r.json()]
        assert uploaded_song["id"] in ids
        # bpm filter (wide range)
        r2 = client.get(f"{API}/songs?min_bpm=0&max_bpm=300", timeout=30)
        assert r2.status_code == 200

    def test_audio_stream(self, client, uploaded_song):
        sid = uploaded_song["id"]
        r = client.get(f"{API}/songs/{sid}/audio", timeout=60)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/")
        assert len(r.content) > 100

    def test_patch_song(self, client, uploaded_song):
        sid = uploaded_song["id"]
        r = client.patch(
            f"{API}/songs/{sid}",
            json={"title": "TEST_Song_Updated", "tags": ["rock", "demo"], "mood": "uplifting", "notes": "n"},
            timeout=30,
        )
        assert r.status_code == 200
        d = r.json()
        assert d["title"] == "TEST_Song_Updated"
        assert "rock" in d["tags"]
        assert d["audio"]["mood"] == "uplifting"
        # GET verify
        r2 = client.get(f"{API}/songs/{sid}", timeout=30)
        assert r2.json()["title"] == "TEST_Song_Updated"


# --- Drafts ---
class TestDrafts:
    def test_draft_flow(self, client, uploaded_song):
        sid = uploaded_song["id"]
        # create 2 drafts
        d1 = client.post(
            f"{API}/songs/{sid}/drafts",
            json={"lyrics": "[VERSE 1]\nTest line 1", "source": "manual"},
            timeout=30,
        )
        assert d1.status_code == 200
        d1j = d1.json()
        assert d1j["version"] >= 1

        d2 = client.post(
            f"{API}/songs/{sid}/drafts",
            json={"lyrics": "[VERSE 1]\nTest line 2", "source": "manual"},
            timeout=30,
        )
        assert d2.status_code == 200
        d2j = d2.json()
        assert d2j["version"] > d1j["version"]

        # list sorted DESC
        lr = client.get(f"{API}/songs/{sid}/drafts", timeout=30)
        assert lr.status_code == 200
        drafts = lr.json()
        assert drafts[0]["version"] >= drafts[-1]["version"]

        # approve d1, verify d2 unset
        ap = client.post(f"{API}/songs/{sid}/drafts/{d1j['id']}/approve", timeout=30)
        assert ap.status_code == 200
        assert ap.json()["is_approved"] is True
        lr2 = client.get(f"{API}/songs/{sid}/drafts", timeout=30)
        approved = [d for d in lr2.json() if d["is_approved"]]
        assert len(approved) == 1
        assert approved[0]["id"] == d1j["id"]

        # delete d2
        dd = client.delete(f"{API}/songs/{sid}/drafts/{d2j['id']}", timeout=30)
        assert dd.status_code == 200
        lr3 = client.get(f"{API}/songs/{sid}/drafts", timeout=30)
        assert d2j["id"] not in [d["id"] for d in lr3.json()]


# --- Lyrics (LLM) ---
class TestLyrics:
    def test_generate_anthropic(self, client, uploaded_song):
        sid = uploaded_song["id"]
        payload = {
            "song_id": sid,
            "theme": "late-night neon city drive",
            "style": "synthwave",
            "must_have_words": ["neon", "midnight"],
            "structure": ["VERSE 1", "CHORUS", "VERSE 2", "CHORUS"],
            "provider": "anthropic",
            "model": "claude-sonnet-4-5-20250929",
        }
        r = client.post(f"{API}/lyrics/generate", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        lyrics = d.get("lyrics", "")
        assert lyrics
        up = lyrics.upper()
        assert "[VERSE 1]" in up or "VERSE 1" in up
        assert "[CHORUS]" in up or "CHORUS" in up
        assert "neon" in lyrics.lower() or "midnight" in lyrics.lower()

    def test_complete(self, client, uploaded_song):
        sid = uploaded_song["id"]
        seed = "[VERSE 1]\nWalking through the neon rain tonight"
        payload = {
            "song_id": sid,
            "theme": "rain city",
            "style": "synthwave",
            "partial_lyrics": seed,
            "must_have_words": ["neon"],
            "provider": "anthropic",
            "model": "claude-sonnet-4-5-20250929",
        }
        r = client.post(f"{API}/lyrics/complete", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        lyrics = r.json().get("lyrics", "")
        assert lyrics
        assert "neon" in lyrics.lower()

    def test_polish(self, client):
        seed = "[VERSE 1]\nWalking through the rain at night\n[CHORUS]\nHold me close until the light\n"
        payload = {
            "theme": "city night",
            "style": "pop",
            "full_lyrics": seed,
            "provider": "anthropic",
            "model": "claude-sonnet-4-5-20250929",
        }
        r = client.post(f"{API}/lyrics/polish", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        assert r.json().get("lyrics")


# --- Providers test endpoint ---
class TestProvidersConn:
    def test_unreachable_endpoint(self, client):
        r = client.post(
            f"{API}/providers/test",
            json={"endpoint": "http://127.0.0.1:59999"},
            timeout=30,
        )
        assert r.status_code == 200
        d = r.json()
        assert d.get("ok") is False
        assert "error" in d or "status" in d

    def test_ollama_bogus_returns_502(self, client):
        payload = {
            "theme": "x",
            "style": "x",
            "must_have_words": [],
            "provider": "ollama",
            "model": "llama3",
            "endpoint": "http://127.0.0.1:59999",
        }
        r = client.post(f"{API}/lyrics/generate", json=payload, timeout=60)
        assert r.status_code == 502, f"expected 502, got {r.status_code}: {r.text}"


# --- Soft delete song last ---
class TestSongDeleteLast:
    def test_soft_delete(self, client, uploaded_song):
        sid = uploaded_song["id"]
        r = client.delete(f"{API}/songs/{sid}", timeout=30)
        assert r.status_code == 200
        # Not in list
        lr = client.get(f"{API}/songs", timeout=30)
        assert sid not in [s["id"] for s in lr.json()]
        # Direct get returns 404
        gr = client.get(f"{API}/songs/{sid}", timeout=30)
        assert gr.status_code == 404
