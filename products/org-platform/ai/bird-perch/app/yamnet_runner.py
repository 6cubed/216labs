"""YAMNet background-sound labels (optional).

YAMNet outputs 521 AudioSet classes (non-bird + bird + environment).
We use it as a lightweight "what else is in this clip?" background scan.

Implementation note:
We intentionally avoid `tensorflow_hub` because it pulls in full `tensorflow` and
can bloat the image. Instead, we download the TFHub "compressed" SavedModel and
load it via `tf.saved_model.load`.
"""

from __future__ import annotations

import os
import tarfile
import tempfile
from typing import Any

import numpy as np

from .tf_lock import TF_LOCK, tf_runtime_init

_tf = None
_model = None
_class_names: list[str] | None = None


def _lazy_tf():
    global _tf
    if _tf is None:
        tf_runtime_init()
        import tensorflow as tf

        _tf = tf
    return _tf


def yamnet_handle() -> str:
    # TFHub module base URL (not the compressed export).
    return os.environ.get("BIRDPERCH_YAMNET_HANDLE", "https://tfhub.dev/google/yamnet/1")


def yamnet_model_dir() -> str:
    # Persist on the /app/data volume in production.
    return os.environ.get("BIRDPERCH_YAMNET_MODEL_DIR", "/app/data/yamnet")


def _download_bytes(url: str, headers: dict[str, str]) -> bytes:
    # Prefer stdlib urllib because some hosts fingerprint http clients.
    import urllib.request

    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=90) as resp:
        return resp.read()


def _ensure_yamnet_on_disk() -> str:
    """Ensure the TFHub module is downloaded/extracted. Returns module directory."""
    target = yamnet_model_dir()
    saved_model = os.path.join(target, "saved_model.pb")
    if os.path.isfile(saved_model):
        return target

    os.makedirs(target, exist_ok=True)
    # TFHub "compressed" format is a tar.gz of a SavedModel dir.
    url = yamnet_handle().rstrip("/") + "?tf-hub-format=compressed"
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "*/*",
    }
    data = _download_bytes(url, headers=headers)

    fd, tmp_path = tempfile.mkstemp(suffix=".tar.gz")
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        with tarfile.open(tmp_path, "r:gz") as tfp:
            tfp.extractall(target)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    return target


def ensure_yamnet_loaded() -> None:
    global _model, _class_names
    if _model is not None:
        return
    with TF_LOCK:
        if _model is not None:
            return
        tf = _lazy_tf()
        model_dir = _ensure_yamnet_on_disk()
        _model = tf.saved_model.load(model_dir)

        # Load class names from the extracted CSV if present.
        class_map = os.path.join(model_dir, "assets", "yamnet_class_map.csv")
        if os.path.isfile(class_map):
            import csv

            names: list[str] = []
            with open(class_map, encoding="utf-8", errors="replace", newline="") as f:
                reader = csv.DictReader(f)
                for row in reader:
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
    with TF_LOCK:
        ensure_yamnet_loaded()
        assert _model is not None
        tf = _lazy_tf()
        y16 = _resample_to_16k(y, sr)
        if y16.size == 0:
            return []

        # YAMNet expects float32 waveform [-1, 1] at 16kHz.
        waveform = tf.constant(y16, dtype=tf.float32)
        # SavedModel signature returns (scores, embeddings, spectrogram).
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

