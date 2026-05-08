"""Local filesystem storage wrapper.
"""
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# Base directory for stored objects
STORAGE_ROOT = Path(__file__).parent / "local_storage"
STORAGE_ROOT.mkdir(parents=True, exist_ok=True)

def init_storage() -> str:
    """Initialize storage (no‑op, ensure directory exists)."""
    STORAGE_ROOT.mkdir(parents=True, exist_ok=True)
    return str(STORAGE_ROOT)

def put_object(path: str, data: bytes, content_type: str) -> dict:
    """Write ``data`` to ``path`` under the storage root.

    Returns a simple dict with the stored path and size. ``content_type`` is ignored
    but kept for API compatibility.
    """
    full_path = STORAGE_ROOT / path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    with open(full_path, "wb") as f:
        f.write(data)
    logger.info("Stored object at %s", full_path)
    return {"path": str(full_path), "size": len(data)}

def get_object(path: str) -> tuple[bytes, str]:
    """Retrieve the object at ``path``.

    Returns a tuple ``(bytes, content_type)``. Raises ``FileNotFoundError`` if the
    file does not exist.
    """
    full_path = STORAGE_ROOT / path
    if not full_path.is_file():
        raise FileNotFoundError(f"Object not found: {path}")
    with open(full_path, "rb") as f:
        data = f.read()
    return data, "application/octet-stream"
