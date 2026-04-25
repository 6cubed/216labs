"""Serialize TensorFlow work across SavedModels (bird classifier + optional YAMNet).

Concurrent `tf.saved_model` inference from asyncio thread pools has produced XLA
reshape errors on small hosts. All TF entrypoints should run under `TF_LOCK`.
"""

from __future__ import annotations

import os
import threading

TF_LOCK = threading.RLock()

_tf_runtime_ready = False
_tf_runtime_lock = threading.Lock()


def tf_runtime_init() -> None:
    """One-time TF import + optional stability tweaks (call before first TF use)."""
    global _tf_runtime_ready
    if _tf_runtime_ready:
        return
    with _tf_runtime_lock:
        if _tf_runtime_ready:
            return
        import tensorflow as tf

        os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
        if os.environ.get("BIRDPERCH_DISABLE_XLA", "").strip() in ("1", "true", "yes"):
            try:
                tf.config.optimizer.set_jit(False)  # type: ignore[attr-defined]
            except Exception:
                pass
        _tf_runtime_ready = True
