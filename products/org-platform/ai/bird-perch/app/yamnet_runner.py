"""YAMNet background-sound labels (optional).

YAMNet outputs 521 AudioSet classes (non-bird + bird + environment).
We use it as a lightweight "what else is in this clip?" background scan.
"""

from __future__ import annotations

import os
from typing import Any

import numpy as np

_tf = None
_hub = None
_model = None
_class_names: list[str] | None = None


def _lazy_tf():
    global _tf
    if _tf is None:
        import tensorflow as tf

        _tf = tf
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    return _tf


def _lazy_hub():
    global _hub
    if _hub is None:
        import tensorflow_hub as hub

        _hub = hub
    return _hub


def yamnet_handle() -> str:
    return os.environ.get("BIRDPERCH_YAMNET_HANDLE", "https://tfhub.dev/google/yamnet/1")


def ensure_yamnet_loaded() -> None:
    global _model, _class_names
    if _model is not None:
        return
    hub = _lazy_hub()
    _lazy_tf()
    _model = hub.load(yamnet_handle())
    # YAMNet hub module exports class_map_path.
    path = getattr(_model, "class_map_path", None)
    if path is not None:
        import csv

        names: list[str] = []
        with open(str(path), encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # yamnet_class_map.csv uses "display_name"
                dn = (row.get("display_name") or "").strip()
                if dn:
                    names.append(dn)
        _class_names = names or None


def _mean_scores(scores: Any) -> np.ndarray:
    # scores: [num_frames, num_classes]
    arr = scores.numpy() if hasattr(scores, "numpy") else np.asarray(scores)
    arr = np.asarray(arr, dtype=np.float32)
    if arr.ndim == 2 and arr.shape[0] > 0:
        return np.mean(arr, axis=0)
    if arr.ndim == 1:
        return arr
    return np.zeros(0, dtype=np.float32)


def _resample_to_16k(y: np.ndarray, sr: int) -> np.ndarray:
    y = np.asarray(y, dtype=np.float32).reshape(-1)
    if sr == 16000:
        return y
    import librosa

    return librosa.resample(y, orig_sr=int(sr), target_sr=16000).astype(np.float32)


def predict_background(y: np.ndarray, sr: int, topk: int = 8) -> list[dict[str, Any]]:
    """Return top-k AudioSet classes with confidence for this clip."""
    ensure_yamnet_loaded()
    assert _model is not None
    tf = _lazy_tf()
    y16 = _resample_to_16k(y, sr)
    if y16.size == 0:
        return []

    # YAMNet expects float32 waveform [-1, 1] at 16kHz.
    waveform = tf.constant(y16, dtype=tf.float32)
    scores, _emb, _spec = _model(waveform)  # type: ignore[misc]
    p = _mean_scores(scores)
    if p.size == 0:
        return []

    k = max(1, int(topk))
    order = np.argsort(-p)[:k]
    out: list[dict[str, Any]] = []
    for rank, j in enumerate(order, start=1):
        j = int(j)
        name = None
        if _class_names and 0 <= j < len(_class_names):
            name = _class_names[j]
        out.append(
            {
                "rank": rank,
                "label": name or f"class_{j}",
                "confidence": float(p[j]),
            }
        )
    return out

