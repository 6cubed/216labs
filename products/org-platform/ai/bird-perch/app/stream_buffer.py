"""Rolling mono float32 buffer built from decoded stream chunks (variable length)."""

from __future__ import annotations

import numpy as np


class ChunkRing:
    """Append float32 mono segments; read a contiguous tail of the last N samples."""

    def __init__(self, max_samples: int) -> None:
        self.max_samples = max(1, int(max_samples))
        self.chunks: list[np.ndarray] = []
        self.total = 0

    def append(self, y: np.ndarray) -> None:
        y = np.asarray(y, dtype=np.float32).reshape(-1)
        if y.size == 0:
            return
        self.chunks.append(y)
        self.total += int(y.size)
        while self.total > self.max_samples and self.chunks:
            old = self.chunks.pop(0)
            self.total -= int(old.size)

    def concat_tail(self, n: int) -> np.ndarray:
        """Return the last ``n`` samples in chronological order (shorter if buffer smaller)."""
        n = int(n)
        if n <= 0 or self.total == 0:
            return np.zeros(0, dtype=np.float32)
        take = min(n, self.total)
        parts: list[np.ndarray] = []
        remain = take
        for c in reversed(self.chunks):
            if remain <= 0:
                break
            sz = int(c.size)
            if sz <= 0:
                continue
            use = min(remain, sz)
            parts.append(c[-use:])
            remain -= use
        if not parts:
            return np.zeros(0, dtype=np.float32)
        parts.reverse()
        return np.concatenate(parts) if len(parts) > 1 else parts[0]
