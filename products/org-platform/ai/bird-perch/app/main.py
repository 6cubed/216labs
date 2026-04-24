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
from .model_runner import ensure_model_loaded, get_expected_samples, predict_waveform
from .stream_buffer import ChunkRing

TARGET_SR = int(os.environ.get("BIRDPERCH_SAMPLE_RATE", "48000"))
MAX_BYTES = int(os.environ.get("BIRDPERCH_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))
STREAM_MAX_CHUNK = int(os.environ.get("BIRDPERCH_STREAM_MAX_CHUNK_BYTES", str(512 * 1024)))
STREAM_INFER_SEC = float(os.environ.get("BIRDPERCH_STREAM_INFER_SEC", "1.5"))
STREAM_RING_SEC = float(os.environ.get("BIRDPERCH_STREAM_RING_SEC", "22"))

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


def _identify_payload(y: np.ndarray) -> dict:
    """Run classifier on waveform (already at TARGET_SR mono)."""
    n = get_expected_samples()
    if isinstance(n, int) and n > 0:
        y = pad_or_crop(y, n)
    result = predict_waveform(y)
    return {
        "species": result.species,
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

            y_infer: np.ndarray | None = None
            buf_samples = 0
            try:
                async with lock:
                    y = await asyncio.to_thread(load_audio_mono, data, TARGET_SR)
                    buf.append(y)
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

            top = result.species[0] if result.species else None
            await websocket.send_json(
                {
                    "type": "tick",
                    "t_mono": time.monotonic(),
                    "buffer_samples": buf_samples,
                    "top": top,
                    "top5": result.species[:5],
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
