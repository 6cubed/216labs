"""Load arbitrary audio bytes into mono float waveform for the classifier."""

from __future__ import annotations

import io
import os
import subprocess
import tempfile

import librosa
import numpy as np
import soundfile as sf


def _sniff_suffix(data: bytes) -> str:
    """Pick a filename suffix so decoders (ffmpeg/audioread) can infer container."""
    if len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return ".wav"
    if len(data) >= 4 and data[:4] == b"OggS":
        return ".ogg"
    if len(data) >= 4 and data[:4] == b"fLaC":
        return ".flac"
    if len(data) >= 4 and data[:4] == b"\x1a\x45\xdf\xa3":
        return ".webm"
    if len(data) >= 8 and data[4:8] == b"ftyp":
        return ".m4a"
    if len(data) >= 3 and (
        data[:3] == b"ID3" or (data[0] == 0xFF and (data[1] & 0xE0) == 0xE0)
    ):
        return ".mp3"
    return ".webm"


def _decode_via_ffmpeg(audio_bytes: bytes) -> bytes:
    """Decode arbitrary audio to mono float32 WAV bytes (soundfile can read this)."""
    p = subprocess.run(
        [
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-vn",
            "-f",
            "wav",
            "-acodec",
            "pcm_f32le",
            "-ac",
            "1",
            "pipe:1",
        ],
        input=audio_bytes,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=120,
        check=False,
    )
    if p.returncode != 0:
        msg = (p.stderr or b"").decode("utf-8", errors="replace").strip()
        raise RuntimeError(msg or f"ffmpeg exited with code {p.returncode}")
    if not p.stdout:
        raise RuntimeError("ffmpeg produced empty output")
    return p.stdout


def _load_via_tempfile_librosa(audio_bytes: bytes) -> tuple[np.ndarray, int]:
    """Last resort: write bytes to a suffixed temp file so librosa/audioread can open."""
    suffix = _sniff_suffix(audio_bytes)
    fd, path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(audio_bytes)
        return librosa.load(path, sr=None, mono=True)
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


def _load_raw(audio_bytes: bytes) -> tuple[np.ndarray, int]:
    """Decode to (waveform, native_sample_rate)."""
    buf = io.BytesIO(audio_bytes)
    try:
        return sf.read(buf, always_2d=False)
    except Exception:
        pass

    try:
        wav_bytes = _decode_via_ffmpeg(audio_bytes)
    except (
        FileNotFoundError,
        RuntimeError,
        subprocess.SubprocessError,
        TimeoutError,
        OSError,
    ):
        return _load_via_tempfile_librosa(audio_bytes)

    return sf.read(io.BytesIO(wav_bytes), always_2d=False)


def load_audio_mono(audio_bytes: bytes, target_sr: int) -> np.ndarray:
    """Decode WAV/WebM/OGG/etc. and resample to target_sr mono float32 [-1, 1]."""
    y, sr = _load_raw(audio_bytes)
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
