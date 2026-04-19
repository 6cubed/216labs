"""Bird Perch — lightweight API + static recorder UI."""

from __future__ import annotations

import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .audio_io import load_audio_mono, pad_or_crop
from .model_runner import ensure_model_loaded, get_expected_samples, predict_waveform

TARGET_SR = int(os.environ.get("BIRDPERCH_SAMPLE_RATE", "48000"))
MAX_BYTES = int(os.environ.get("BIRDPERCH_MAX_UPLOAD_BYTES", str(8 * 1024 * 1024)))

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


@app.get("/")
async def index():
    index_path = os.path.join(BASE_DIR, "static", "index.html")
    if not os.path.isfile(index_path):
        return {"service": "bird-perch", "hint": "static/index.html missing"}
    return FileResponse(index_path)


@app.get("/healthz")
def healthz():
    """Cheap probe for activator / Caddy (matches other apps)."""
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

    n = get_expected_samples()
    if isinstance(n, int) and n > 0:
        y = pad_or_crop(y, n)

    try:
        result = predict_waveform(y)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "species": result.species,
        "embedding_preview": result.embedding,
        "note": result.note,
        "sample_rate": TARGET_SR,
        "samples": int(y.shape[0]),
    }
