"""
Google bird-vocalization-classifier (TF2) via Kaggle Models + k-NN style ranked list.

Species ranking uses softmax probabilities from the classifier logits (equivalent to
nearest directions in logit space when comparing against class axes). See model card on Kaggle.
"""

from __future__ import annotations

import glob
import os
import re
from dataclasses import dataclass
from typing import Any

import numpy as np

_tf = None
_model = None
_infer_fn = None
_labels: list[str] | None = None
_expected_samples: int | None = None


@dataclass
class PredictResult:
    species: list[dict[str, Any]]
    embedding: list[float] | None
    note: str


def _lazy_tf():
    global _tf
    if _tf is None:
        import tensorflow as tf

        _tf = tf
        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
    return _tf


def model_handle() -> str:
    return os.environ.get(
        "BIRDPERCH_MODEL_HANDLE",
        "google/bird-vocalization-classifier/tensorFlow2/bird-vocalization-classifier/4",
    )


def download_model_path() -> str:
    path = os.environ.get("BIRDPERCH_MODEL_PATH", "").strip()
    if path and os.path.isdir(path):
        return path
    import kagglehub

    handle = model_handle()
    try:
        if re.search(r"/\d+$", handle.strip()):
            return kagglehub.model_download(handle.strip())
    except Exception:
        pass
    try:
        return kagglehub.model_download(
            "google/bird-vocalization-classifier/tensorFlow2/bird-vocalization-classifier",
            version=4,
        )
    except Exception:
        try:
            # Some Kaggle listings use capital T in TensorFlow2
            return kagglehub.model_download(
                "google/bird-vocalization-classifier/TensorFlow2/bird-vocalization-classifier",
                version=4,
            )
        except Exception:
            return kagglehub.model_download(handle.strip())


def _find_label_file(model_dir: str) -> str | None:
    for pattern in (
        "**/labels.txt",
        "**/label_map.txt",
        "**/*label*.txt",
        "**/assets/label.csv",
        "**/assets/labels.csv",
    ):
        hits = glob.glob(os.path.join(model_dir, pattern), recursive=True)
        if hits:
            return hits[0]
    return None


def _load_labels(model_dir: str, num_classes: int) -> list[str]:
    global _labels
    if _labels is not None and len(_labels) == num_classes:
        return _labels

    path = _find_label_file(model_dir)
    out: list[str] = []
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8", errors="replace") as f:
            if path.endswith(".csv"):
                for line in f:
                    line = line.strip()
                    if not line or line.lower().startswith("index"):
                        continue
                    parts = line.split(",")
                    name = parts[-1].strip() if parts else line
                    out.append(name)
            else:
                for line in f:
                    line = line.strip()
                    if line:
                        out.append(line)
    while len(out) < num_classes:
        out.append(f"species_{len(out)}")
    _labels = out[:num_classes]
    return _labels


def get_expected_samples() -> int | None:
    return _expected_samples


def is_model_ready() -> bool:
    return _model is not None or os.environ.get("BIRDPERCH_MOCK", "").strip() in (
        "1",
        "true",
        "yes",
    )


def ensure_model_loaded() -> None:
    global _model, _infer_fn, _expected_samples
    if _model is not None:
        return
    if os.environ.get("BIRDPERCH_MOCK", "").strip() in ("1", "true", "yes"):
        return

    tf = _lazy_tf()
    path = download_model_path()
    _model = tf.saved_model.load(path)
    infer = _model.signatures.get("serving_default")
    if infer is None:
        infer = next(iter(_model.signatures.values()))

    structured_in = infer.structured_input_signature
    for _name, tensor in (structured_in[1] or {}).items():
        sh = tensor.shape.as_list()
        if len(sh) >= 2 and sh[-1] is not None:
            try:
                _expected_samples = int(sh[-1])
            except (TypeError, ValueError):
                pass
        break

    _infer_fn = infer


def _extract_logits(out: dict) -> np.ndarray:
    def to_flat(t) -> np.ndarray:
        return t.numpy().reshape(-1) if hasattr(t, "numpy") else np.asarray(t).reshape(-1)

    preferred = ("logits", "predictions", "prediction", "output_0", "dense")
    for key in preferred:
        if key in out:
            return to_flat(out[key])
    best = None
    best_n = 0
    for _key, t in out.items():
        arr = to_flat(t)
        if arr.size > best_n and arr.size < 100_000:
            best_n = arr.size
            best = arr
    if best is None:
        raise RuntimeError("No logits-like tensor in model output")
    return best


def _run_mock(_waveform: np.ndarray) -> PredictResult:
    rng = np.random.default_rng(42)
    logits = rng.standard_normal(220).astype(np.float64)
    logits[17] += 4.0
    logits[99] += 2.0
    p = _softmax(logits)
    order = np.argsort(-p)[:12]
    z = _l2_norm(logits)
    species = [
        {
            "rank": i + 1,
            "species": f"(mock) bird_class_{int(j)}",
            "confidence": float(p[int(j)]),
            "cosine_to_class_axis": float(z[int(j)]),
        }
        for i, j in enumerate(order)
    ]
    return PredictResult(
        species=species,
        embedding=z.tolist()[:256],
        note="BIRDPERCH_MOCK=1 — set BIRDPERCH_MODEL_PATH or allow kagglehub download for live model.",
    )


def _softmax(x: np.ndarray) -> np.ndarray:
    x = x - np.max(x)
    e = np.exp(x)
    return e / (np.sum(e) + 1e-12)


def _l2_norm(v: np.ndarray) -> np.ndarray:
    n = np.linalg.norm(v) + 1e-9
    return (v / n).astype(np.float64)


def _nearest_from_logits(logits: np.ndarray, labels: list[str], k: int = 15) -> list[dict[str, Any]]:
    p = _softmax(logits.astype(np.float64))
    order = np.argsort(-p)[:k]
    z = _l2_norm(logits.astype(np.float64))
    out: list[dict[str, Any]] = []
    for rank, j in enumerate(order, start=1):
        j = int(j)
        name = labels[j] if j < len(labels) else f"class_{j}"
        u = np.zeros_like(z)
        u[j] = 1.0
        cos = float(np.dot(z, u))
        out.append(
            {
                "rank": rank,
                "species": name,
                "confidence": float(p[j]),
                "logit": float(logits[j]),
                "cosine_to_class_axis": cos,
            }
        )
    return out


def predict_waveform(waveform: np.ndarray) -> PredictResult:
    if os.environ.get("BIRDPERCH_MOCK", "").strip() in ("1", "true", "yes"):
        return _run_mock(waveform)

    tf = _lazy_tf()
    ensure_model_loaded()
    assert _infer_fn is not None

    model_root = download_model_path()

    spec_in = _infer_fn.structured_input_signature[1] or {}
    feed: dict[str, Any] = {}
    w = waveform.astype(np.float32)
    for _name, tensor in spec_in.items():
        sh = tensor.shape.as_list()
        if len(sh) == 2 and sh[0] == 1:
            T = sh[1]
            if T is not None and isinstance(T, int) and w.shape[0] != T:
                from .audio_io import pad_or_crop

                w = pad_or_crop(w, T)
            feed[_name] = tf.constant(w[np.newaxis, :], dtype=tf.float32)
        elif len(sh) == 1:
            feed[_name] = tf.constant(w, dtype=tf.float32)
        else:
            feed[_name] = tf.constant(w[np.newaxis, :], dtype=tf.float32)

    raw = _infer_fn(**feed)
    logits = _extract_logits(dict(raw))

    num_classes = int(logits.shape[0])
    labels = _load_labels(model_root, num_classes)
    species = _nearest_from_logits(logits, labels)

    zn = _l2_norm(logits.astype(np.float64))
    emb_out = zn.tolist()[: min(512, zn.size)]

    return PredictResult(
        species=species,
        embedding=emb_out,
        note="Ranked by classifier softmax (k-NN over class directions in logit space). "
        "Model: google/bird-vocalization-classifier TF2 on Kaggle.",
    )
