import io
import base64
import hashlib
import logging
import tempfile
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

from .models import segment_image, caption_crop

logger = logging.getLogger(__name__)

MAX_DIM = 1024
MAX_SEGMENTS = 20


def _resize(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    if max(h, w) <= MAX_DIM:
        return image
    scale = MAX_DIM / max(h, w)
    return cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def _mask_to_rle(mask: np.ndarray) -> dict:
    """Encode a binary mask as a compact run-length encoding for the frontend."""
    flat = mask.flatten()
    changes = np.diff(flat.astype(np.int8))
    runs = np.where(changes != 0)[0] + 1
    runs = np.concatenate([[0], runs, [len(flat)]])
    lengths = np.diff(runs).tolist()
    start_val = int(flat[0])
    return {"startValue": start_val, "lengths": lengths}


def _random_color(seed: int) -> list[int]:
    rng = np.random.RandomState(seed)
    return rng.randint(60, 220, size=3).tolist()


def process_frame(image_rgb: np.ndarray, frame_index: int = 0) -> dict:
    """
    Segment a single frame and caption each region.
    Returns JSON-serialisable dict with segments and image dimensions.
    """
    image_rgb = _resize(image_rgb)
    h, w = image_rgb.shape[:2]
    pil_image = Image.fromarray(image_rgb)

    masks = segment_image(image_rgb)
    masks = masks[:MAX_SEGMENTS]

    segments = []
    for i, mask_data in enumerate(masks):
        mask = mask_data["segmentation"]
        bbox = mask_data["bbox"]  # x, y, w, h
        x, y, bw, bh = [int(v) for v in bbox]

        crop = pil_image.crop((x, y, x + bw, y + bh))
        caption = caption_crop(crop)

        color = _random_color(i + frame_index * 100)
        segments.append({
            "id": i,
            "caption": caption,
            "bbox": {"x": x, "y": y, "w": bw, "h": bh},
            "area": int(mask_data["area"]),
            "color": color,
            "mask_rle": _mask_to_rle(mask),
        })

    buf = io.BytesIO()
    pil_image.save(buf, format="JPEG", quality=85)
    image_b64 = base64.b64encode(buf.getvalue()).decode()

    return {
        "frame_index": frame_index,
        "width": w,
        "height": h,
        "image_b64": image_b64,
        "segments": segments,
    }


def extract_video_frames(video_bytes: bytes, fps: int = 1) -> list[np.ndarray]:
    """Extract frames from a video at the given fps."""
    tmp = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    tmp.write(video_bytes)
    tmp.flush()

    cap = cv2.VideoCapture(tmp.name)
    source_fps = cap.get(cv2.CAP_PROP_FPS) or 30
    interval = max(1, int(round(source_fps / fps)))

    frames = []
    idx = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        if idx % interval == 0:
            frames.append(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        idx += 1

    cap.release()
    Path(tmp.name).unlink(missing_ok=True)
    return frames
