"""Load arbitrary audio bytes into mono float waveform for the classifier."""

from __future__ import annotations

import io

import librosa
import numpy as np
import soundfile as sf


def load_audio_mono(audio_bytes: bytes, target_sr: int) -> np.ndarray:
    """Decode WAV/WebM/OGG/etc. and resample to target_sr mono float32 [-1, 1]."""
    buf = io.BytesIO(audio_bytes)
    try:
        y, sr = sf.read(buf, always_2d=False)
    except Exception:
        buf.seek(0)
        y, sr = librosa.load(buf, sr=None, mono=True)
    else:
        if y.ndim > 1:
            y = np.mean(y, axis=1)
        y = y.astype(np.float32)
        if sr != target_sr:
            y = librosa.resample(y, orig_sr=int(sr), target_sr=target_sr)
        y = np.asarray(y, dtype=np.float32)
        peak = float(np.max(np.abs(y))) + 1e-9
        if peak > 1.0:
            y = y / peak
        return y

    y = np.asarray(y, dtype=np.float32)
    if sr != target_sr:
        y = librosa.resample(y, orig_sr=int(sr), target_sr=target_sr)
    peak = float(np.max(np.abs(y))) + 1e-9
    if peak > 1.0:
        y = y / peak
    return y


def pad_or_crop(y: np.ndarray, num_samples: int) -> np.ndarray:
    """Center-crop or zero-pad to exact length."""
    if y.shape[0] == num_samples:
        return y
    if y.shape[0] > num_samples:
        start = (y.shape[0] - num_samples) // 2
        return y[start : start + num_samples]
    out = np.zeros(num_samples, dtype=np.float32)
    start = (num_samples - y.shape[0]) // 2
    out[start : start + y.shape[0]] = y
    return out
