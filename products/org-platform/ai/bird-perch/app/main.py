"""Bird Perch — lightweight API + static recorder UI."""

from __future__ import annotations

import asyncio
import json
import os
import time

import numpy as np
from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.websockets import WebSocketDisconnect

from .audio_io import load_audio_mono, pad_or_crop
from .model_runner import ensure_model_loaded, get_expected_samples, model_handle, predict_waveform
from .stream_buffer import ChunkRing
from .taxonomy import (
    ensure_taxonomy_csv,
    last_taxonomy_ensure_error,
    parse_ebird_taxonomy_csv,
    reset_taxonomy_cache,
)
from .yamnet_runner import predict_background


def _env_int(key: str, default: int) -> int:
    v = os.environ.get(key, "")
    v = v.strip() if isinstance(v, str) else ""
    if not v:
        return int(default)
    try:
        return int(v)
    except (TypeError, ValueError):
        return int(default)


def _env_float(key: str, default: float) -> float:
    v = os.environ.get(key, "")
    v = v.strip() if isinstance(v, str) else ""
    if not v:
        return float(default)
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)

TARGET_SR = _env_int("BIRDPERCH_SAMPLE_RATE", 48000)
MAX_BYTES = _env_int("BIRDPERCH_MAX_UPLOAD_BYTES", 8 * 1024 * 1024)
STREAM_MAX_CHUNK = _env_int("BIRDPERCH_STREAM_MAX_CHUNK_BYTES", 512 * 1024)
STREAM_INFER_SEC = _env_float("BIRDPERCH_STREAM_INFER_SEC", 1.5)
STREAM_RING_SEC = _env_float("BIRDPERCH_STREAM_RING_SEC", 22.0)
# MediaRecorder sends WebM fragments; only the first chunk usually includes the EBML init segment.
# Accumulate raw bytes and decode the growing blob; append only the new PCM tail so the ring buffer
# is not double-counted on each full-file re-decode.
STREAM_MAX_WEBM_ACC = _env_int("BIRDPERCH_STREAM_MAX_WEBM_BYTES", 15 * 1024 * 1024)
MIN_CONF = _env_float("BIRDPERCH_MIN_CONF", 0.20)

app = FastAPI(title="Bird Perch", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get("BIRDPERCH_CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
static_dir = os.path.join(BASE_DIR, "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")

TAXONOMY_PATH = os.environ.get("BIRDPERCH_EBIRD_TAXONOMY_CSV", "").strip() or os.path.join(
    BASE_DIR, "data", "ebird_taxonomy.csv"
)


@app.on_event("startup")
def _startup_taxonomy_prefetch():
    # Best-effort: download a taxonomy CSV into /app/data if missing so results are human-readable.
    ensure_taxonomy_csv(TAXONOMY_PATH)


def _identify_payload(y: np.ndarray) -> dict:
    """Run classifier on waveform (already at TARGET_SR mono)."""
    n = get_expected_samples()
    if isinstance(n, int) and n > 0:
        y = pad_or_crop(y, n)
    result = predict_waveform(y)
    yamnet_on = os.environ.get("BIRDPERCH_YAMNET", "").strip() in ("1", "true", "yes")
    bg = []
    if yamnet_on:
        topk = int(os.environ.get("BIRDPERCH_YAMNET_TOPK", "8"))
        try:
            bg = predict_background(y, TARGET_SR, topk=topk)
        except Exception:
            bg = []
    return {
        "species": result.species,
        "background": bg,
        "embedding_preview": result.embedding,
        "note": result.note,
        "sample_rate": TARGET_SR,
        "samples": int(y.shape[0]),
    }


@app.get("/")
async def index():
    index_path = os.path.join(BASE_DIR, "static", "index.html")
    if not os.path.isfile(index_path):
        return {"service": "bird-perch", "hint": "static/index.html missing"}
    return FileResponse(index_path)


@app.get("/healthz")
def healthz():
    """Cheap probe for load balancers / Caddy (no model load)."""
    return {"ok": True}


@app.get("/api/health")
def health():
    mock = os.environ.get("BIRDPERCH_MOCK", "").strip() in ("1", "true", "yes")
    # Do not download the TF model on health checks — first /api/identify loads it.
    return {"ok": True, "model": "mock" if mock else "lazy", "mock": mock}


@app.get("/api/info")
def info():
    """Runtime info for debugging model/threshold/config issues."""
    mock = os.environ.get("BIRDPERCH_MOCK", "").strip() in ("1", "true", "yes")
    present, resolved = ensure_taxonomy_csv(TAXONOMY_PATH)
    yamnet_on = os.environ.get("BIRDPERCH_YAMNET", "").strip() in ("1", "true", "yes")
    return {
        "ok": True,
        "mock": mock,
        "model_handle": model_handle(),
        "expected_samples": get_expected_samples(),
        "taxonomy_present": present,
        "taxonomy_path": resolved,
        "yamnet": yamnet_on,
        "min_conf": MIN_CONF,
        "stream": {
            "infer_sec": STREAM_INFER_SEC,
            "ring_sec": STREAM_RING_SEC,
            "max_chunk_bytes": STREAM_MAX_CHUNK,
            "max_webm_bytes": STREAM_MAX_WEBM_ACC,
        },
    }


@app.get("/api/taxonomy")
def taxonomy_status():
    """Whether a taxonomy CSV is present for human-readable species names."""
    present, resolved = ensure_taxonomy_csv(TAXONOMY_PATH)
    return {"ok": True, "present": present, "path": resolved, "ensure_error": last_taxonomy_ensure_error()}


@app.post("/api/taxonomy")
async def upload_taxonomy(file: UploadFile = File(...)):
    """Upload an eBird taxonomy CSV to the server (persisted on the /app/data volume)."""
    raw = await file.read()
    if len(raw) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="CSV too large")
    try:
        txt = raw.decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read CSV: {e}") from e

    # Validate headers / format before writing.
    import tempfile

    with tempfile.NamedTemporaryFile("w", delete=True, encoding="utf-8", newline="") as tmp:
        tmp.write(txt)
        tmp.flush()
        mapping = parse_ebird_taxonomy_csv(tmp.name)
    if not mapping:
        raise HTTPException(
            status_code=400,
            detail="CSV did not parse (need SPECIES_CODE + COMMON_NAME columns; optional SCIENTIFIC_NAME).",
        )

    os.makedirs(os.path.dirname(TAXONOMY_PATH), exist_ok=True)
    with open(TAXONOMY_PATH, "w", encoding="utf-8", newline="") as f:
        f.write(txt)
    reset_taxonomy_cache()
    return {"ok": True, "saved_to": TAXONOMY_PATH, "rows": len(mapping)}


@app.post("/api/identify")
async def identify(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Audio too large")
    if len(raw) < 256:
        raise HTTPException(status_code=400, detail="Audio too short")

    try:
        y = load_audio_mono(raw, TARGET_SR)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not decode audio: {e}") from e

    try:
        ensure_model_loaded()
    except Exception as e:
        if os.environ.get("BIRDPERCH_MOCK", "").strip() not in ("1", "true", "yes"):
            raise HTTPException(status_code=503, detail=f"Model unavailable: {e}") from e

    try:
        return _identify_payload(y)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


@app.websocket("/ws/listen")
async def ws_listen(websocket: WebSocket):
    """Continuous listen: client sends WebM/Opus chunks; server decodes into a ring buffer and
    periodically returns softmax-ranked species (top match = current best guess)."""
    await websocket.accept()
    max_samples = max(int(TARGET_SR * STREAM_RING_SEC), int(TARGET_SR * 3))
    buf = ChunkRing(max_samples)
    lock = asyncio.Lock()
    last_infer = 0.0
    infer_interval = max(0.35, STREAM_INFER_SEC)
    webm_acc = bytearray()
    last_decoded_samples = 0
    try:
        await websocket.send_json(
            {
                "type": "hello",
                "target_sr": TARGET_SR,
                "infer_interval_ms": int(infer_interval * 1000),
                "ring_seconds": STREAM_RING_SEC,
            }
        )
        while True:
            try:
                msg = await websocket.receive()
            except WebSocketDisconnect:
                break
            if "text" in msg and msg["text"] is not None:
                try:
                    j = json.loads(msg["text"])
                    if j.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except (json.JSONDecodeError, TypeError, ValueError):
                    pass
                continue
            if "bytes" not in msg or msg["bytes"] is None:
                continue
            data = msg["bytes"]
            if len(data) > STREAM_MAX_CHUNK:
                await websocket.send_json({"type": "error", "detail": "Audio chunk too large"})
                continue

            if len(webm_acc) + len(data) > STREAM_MAX_WEBM_ACC:
                await websocket.send_json(
                    {
                        "type": "error",
                        "detail": "Live stream buffer full — stop and start continuous listening again.",
                    }
                )
                continue

            webm_acc.extend(data)

            try:
                y_full = await asyncio.to_thread(load_audio_mono, bytes(webm_acc), TARGET_SR)
            except Exception:
                # Typical while the accumulated WebM is still a truncated fragment (no init segment yet).
                continue

            y_full = np.asarray(y_full, dtype=np.float32).reshape(-1)
            if y_full.size == 0:
                continue

            y_infer: np.ndarray | None = None
            buf_samples = 0
            try:
                async with lock:
                    if y_full.size < last_decoded_samples:
                        last_decoded_samples = 0
                        buf.clear()
                    delta = y_full[int(last_decoded_samples) :]
                    last_decoded_samples = int(y_full.size)
                    if delta.size > 0:
                        buf.append(delta)
                    now = time.monotonic()
                    if now - last_infer < infer_interval:
                        y_infer = None
                    else:
                        n_model = get_expected_samples()
                        if isinstance(n_model, int) and n_model > 0:
                            window = int(n_model)
                        else:
                            window = min(max(buf.total, 1), TARGET_SR * 3)
                        min_tail = max(4000, min(window, TARGET_SR // 2))
                        if buf.total < min_tail:
                            y_infer = None
                        else:
                            last_infer = now
                            take = min(buf.total, window if window > 0 else TARGET_SR * 2)
                            y_win = np.asarray(buf.concat_tail(take), dtype=np.float32).copy()
                            if isinstance(n_model, int) and n_model > 0:
                                y_infer = pad_or_crop(y_win, n_model)
                            else:
                                y_infer = y_win
                            buf_samples = buf.total
            except Exception as e:
                await websocket.send_json({"type": "error", "detail": f"decode: {e}"})
                continue

            if y_infer is None or y_infer.size == 0:
                continue

            try:
                await asyncio.to_thread(ensure_model_loaded)
            except Exception as e:
                if os.environ.get("BIRDPERCH_MOCK", "").strip() not in ("1", "true", "yes"):
                    await websocket.send_json({"type": "error", "detail": f"Model unavailable: {e}"})
                    continue

            try:
                result = await asyncio.to_thread(predict_waveform, y_infer)
            except Exception as e:
                await websocket.send_json({"type": "error", "detail": str(e)})
                continue
            bg = []
            yamnet_on = os.environ.get("BIRDPERCH_YAMNET", "").strip() in ("1", "true", "yes")
            if yamnet_on:
                topk = int(os.environ.get("BIRDPERCH_YAMNET_TOPK", "5"))
                try:
                    bg = await asyncio.to_thread(predict_background, y_infer, TARGET_SR, topk=topk)
                except Exception:
                    bg = []

            top = result.species[0] if result.species else None
            if top and isinstance(top, dict):
                c = top.get("confidence")
                if isinstance(c, (int, float)) and float(c) < MIN_CONF:
                    top = None
            await websocket.send_json(
                {
                    "type": "tick",
                    "t_mono": time.monotonic(),
                    "buffer_samples": buf_samples,
                    "top": top,
                    "top5": result.species[:5],
                    "bg5": bg[:5],
                    "min_conf": MIN_CONF,
                    "note": result.note,
                }
            )
    except WebSocketDisconnect:
        pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
