"""Tests for share links + SSE streaming endpoints (iteration 2)."""
import os
import json
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000").rstrip("/")

API = f"{BASE_URL}/api"
WAV_PATH = "/tmp/test.wav"


@pytest.fixture(scope="module")
def client():
    return requests.Session()


@pytest.fixture(scope="module")
def song_with_draft(client):
    # upload a song
    with open(WAV_PATH, "rb") as fh:
        files = {"file": ("test.wav", fh, "audio/wav")}
        data = {"title": "TEST_ShareSong"}
        r = client.post(f"{API}/songs/upload", files=files, data=data, timeout=120)
    assert r.status_code == 200, r.text
    song = r.json()
    sid = song["id"]
    # create a draft
    r2 = client.post(
        f"{API}/songs/{sid}/drafts",
        json={"lyrics": "[VERSE 1]\nShared night vibes\n[CHORUS]\nLet it ride", "source": "manual", "is_approved": True},
        timeout=30,
    )
    assert r2.status_code == 200, r2.text
    draft = r2.json()
    yield song, draft
    # teardown
    client.delete(f"{API}/songs/{sid}", timeout=30)


# --- Share endpoints ---
class TestShare:
    def test_create_share_idempotent(self, client, song_with_draft):
        song, draft = song_with_draft
        r = client.post(f"{API}/songs/{song['id']}/drafts/{draft['id']}/share", timeout=30)
        assert r.status_code == 200, r.text
        s1 = r.json()
        for k in ("slug", "song_id", "draft_id", "is_revoked", "view_count", "created_at"):
            assert k in s1, f"missing field: {k}"
        assert s1["is_revoked"] is False
        assert s1["view_count"] == 0
        assert s1["song_id"] == song["id"]
        assert s1["draft_id"] == draft["id"]

        # Second call → SAME slug
        r2 = client.post(f"{API}/songs/{song['id']}/drafts/{draft['id']}/share", timeout=30)
        assert r2.status_code == 200
        s2 = r2.json()
        assert s2["slug"] == s1["slug"], "expected idempotent share creation"

    def test_get_share_increments_view_count(self, client, song_with_draft):
        song, draft = song_with_draft
        # ensure share exists
        r = client.post(f"{API}/songs/{song['id']}/drafts/{draft['id']}/share", timeout=30)
        slug = r.json()["slug"]

        g1 = client.get(f"{API}/share/{slug}", timeout=30)
        assert g1.status_code == 200, g1.text
        d1 = g1.json()
        assert d1["slug"] == slug
        assert "song" in d1 and d1["song"]["id"] == song["id"]
        assert d1["song"]["title"] == "TEST_ShareSong"
        assert "audio" in d1["song"]
        assert "lyrics" in d1 and "VERSE" in d1["lyrics"].upper()
        assert "draft_version" in d1
        v1 = d1["view_count"]

        g2 = client.get(f"{API}/share/{slug}", timeout=30)
        assert g2.status_code == 200
        v2 = g2.json()["view_count"]
        assert v2 == v1 + 1, f"view count not incremented: {v1} -> {v2}"

    def test_share_audio_stream(self, client, song_with_draft):
        song, draft = song_with_draft
        r = client.post(f"{API}/songs/{song['id']}/drafts/{draft['id']}/share", timeout=30)
        slug = r.json()["slug"]
        g = client.get(f"{API}/share/{slug}/audio", timeout=60)
        assert g.status_code == 200
        ct = g.headers.get("content-type", "")
        assert ct.startswith("audio/"), f"unexpected content-type: {ct}"
        assert len(g.content) > 100

    def test_list_shares_for_song(self, client, song_with_draft):
        song, draft = song_with_draft
        r = client.post(f"{API}/songs/{song['id']}/drafts/{draft['id']}/share", timeout=30)
        slug = r.json()["slug"]
        lr = client.get(f"{API}/songs/{song['id']}/shares", timeout=30)
        assert lr.status_code == 200
        slugs = [s["slug"] for s in lr.json()]
        assert slug in slugs

    def test_unknown_slug_404(self, client):
        r = client.get(f"{API}/share/no-such-slug-zzz-999", timeout=30)
        assert r.status_code == 404

    def test_revoke_share(self, client, song_with_draft):
        song, draft = song_with_draft
        # Create new song+draft+share to revoke (avoid affecting other tests)
        with open(WAV_PATH, "rb") as fh:
            files = {"file": ("test.wav", fh, "audio/wav")}
            data = {"title": "TEST_RevokeSong"}
            up = client.post(f"{API}/songs/upload", files=files, data=data, timeout=120)
        sid = up.json()["id"]
        d = client.post(
            f"{API}/songs/{sid}/drafts",
            json={"lyrics": "to be revoked", "source": "manual", "is_approved": True},
            timeout=30,
        ).json()
        sh = client.post(f"{API}/songs/{sid}/drafts/{d['id']}/share", timeout=30).json()
        slug = sh["slug"]

        # Confirm accessible
        assert client.get(f"{API}/share/{slug}", timeout=30).status_code == 200

        # Revoke
        rv = client.delete(f"{API}/shares/{slug}", timeout=30)
        assert rv.status_code == 200
        assert rv.json().get("ok") is True

        # Now 404
        gone = client.get(f"{API}/share/{slug}", timeout=30)
        assert gone.status_code == 404

        # And list_shares_for_song should not include revoked
        lr = client.get(f"{API}/songs/{sid}/shares", timeout=30)
        assert slug not in [s["slug"] for s in lr.json()]

        # cleanup
        client.delete(f"{API}/songs/{sid}", timeout=30)

    def test_revoke_unknown_404(self, client):
        r = client.delete(f"{API}/shares/no-such-slug-abc-000", timeout=30)
        assert r.status_code == 404


# --- SSE Streaming ---
def _consume_sse(resp, max_seconds=60):
    """Parse SSE response into list of (event, data) tuples."""
    events = []
    cur_event = None
    cur_data = []
    start = time.time()
    for raw in resp.iter_lines(decode_unicode=True):
        if time.time() - start > max_seconds:
            break
        if raw is None:
            continue
        if raw == "":
            # blank line = dispatch
            if cur_event is not None:
                data_str = "\n".join(cur_data)
                try:
                    parsed = json.loads(data_str)
                except Exception:
                    parsed = data_str
                events.append((cur_event, parsed))
                if cur_event in ("done", "error"):
                    break
            cur_event = None
            cur_data = []
            continue
        if raw.startswith("event:"):
            cur_event = raw.split(":", 1)[1].strip()
        elif raw.startswith("data:"):
            cur_data.append(raw.split(":", 1)[1].lstrip())
    return events


class TestSSE:
    def _sse_payload_generate(self):
        return {
            "theme": "midnight",
            "style": "synthwave",
            "must_have_words": ["neon"],
            "extra_notes": "keep it short — 4 lines max",
            "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001",
        }

    def test_generate_stream_sse(self, client):
        with client.post(
            f"{API}/lyrics/generate/stream",
            json=self._sse_payload_generate(),
            stream=True,
            timeout=120,
        ) as r:
            assert r.status_code == 200, r.text
            ct = r.headers.get("content-type", "")
            assert "text/event-stream" in ct, f"bad content-type: {ct}"
            evs = _consume_sse(r, max_seconds=90)

        kinds = [e[0] for e in evs]
        assert "status" in kinds, f"missing status event: {kinds[:5]}"
        deltas = [d for k, d in evs if k == "delta"]
        assert len(deltas) > 1, f"expected multiple deltas, got {len(deltas)}"
        done = [d for k, d in evs if k == "done"]
        assert done, "missing 'done' event"
        done_data = done[-1]
        assert "lyrics" in done_data
        assert done_data.get("provider") == "anthropic"
        assert done_data.get("model") == "claude-haiku-4-5-20251001"
        assert len(done_data["lyrics"]) > 0

    def test_complete_stream_sse(self, client):
        payload = {
            "theme": "rain",
            "style": "synthwave",
            "partial_lyrics": "[VERSE 1]\nWalking through neon",
            "must_have_words": ["neon"],
            "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001",
        }
        with client.post(
            f"{API}/lyrics/complete/stream",
            json=payload,
            stream=True,
            timeout=120,
        ) as r:
            assert r.status_code == 200, r.text
            evs = _consume_sse(r, max_seconds=90)
        kinds = [e[0] for e in evs]
        assert "delta" in kinds
        assert "done" in kinds
        done = [d for k, d in evs if k == "done"][-1]
        assert "lyrics" in done

    def test_polish_stream_sse(self, client):
        payload = {
            "theme": "city",
            "style": "pop",
            "full_lyrics": "[VERSE 1]\nrain at night\n[CHORUS]\nhold me",
            "feedback": "tighten chorus, keep it short",
            "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001",
        }
        with client.post(
            f"{API}/lyrics/polish/stream",
            json=payload,
            stream=True,
            timeout=120,
        ) as r:
            assert r.status_code == 200, r.text
            evs = _consume_sse(r, max_seconds=90)
        kinds = [e[0] for e in evs]
        assert "delta" in kinds
        assert "done" in kinds


# --- Regression: non-streaming endpoints still work ---
class TestNonStreamRegression:
    def test_generate_non_stream(self, client):
        payload = {
            "theme": "stars",
            "style": "pop",
            "must_have_words": ["star"],
            "extra_notes": "keep it short — 4 lines max",
            "provider": "anthropic",
            "model": "claude-haiku-4-5-20251001",
        }
        r = client.post(f"{API}/lyrics/generate", json=payload, timeout=120)
        assert r.status_code == 200, r.text
        assert r.json().get("lyrics")
