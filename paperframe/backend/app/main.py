import logging
import io

import numpy as np
from PIL import Image
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .processing import process_frame, extract_video_frames
from .models import get_device

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="Paperframe API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/bmp"}
VIDEO_TYPES = {"video/mp4", "video/quicktime", "video/webm", "video/x-msvideo"}


@app.get("/health")
async def health():
    return {"status": "ok", "device": get_device()}


@app.post("/process")
async def process_upload(file: UploadFile = File(...)):
    content_type = file.content_type or ""
    data = await file.read()

    if not data:
        raise HTTPException(400, "Empty file")

    if content_type in IMAGE_TYPES or content_type.startswith("image/"):
        logger.info("Processing image (%d bytes)", len(data))
        image = np.array(Image.open(io.BytesIO(data)).convert("RGB"))
        result = process_frame(image)
        return JSONResponse({"type": "image", "frames": [result]})

    if content_type in VIDEO_TYPES or content_type.startswith("video/"):
        logger.info("Processing video (%d bytes)", len(data))
        frames = extract_video_frames(data, fps=1)
        if not frames:
            raise HTTPException(400, "Could not extract frames from video")
        logger.info("Extracted %d frames at 1 fps", len(frames))
        results = [process_frame(f, i) for i, f in enumerate(frames)]
        return JSONResponse({"type": "video", "frames": results})

    raise HTTPException(
        400,
        f"Unsupported file type: {content_type}. Upload an image or video.",
    )
