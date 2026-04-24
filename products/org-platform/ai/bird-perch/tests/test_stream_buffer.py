"""Unit tests for rolling stream buffer (live listen)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.stream_buffer import ChunkRing  # noqa: E402


class TestChunkRing(unittest.TestCase):
    def test_append_concat_tail_order(self):
        r = ChunkRing(100_000)
        r.append(np.array([1.0, 2.0], dtype=np.float32))
        r.append(np.array([3.0, 4.0, 5.0], dtype=np.float32))
        tail = r.concat_tail(4)
        np.testing.assert_array_equal(tail, np.array([2.0, 3.0, 4.0, 5.0], dtype=np.float32))
        self.assertEqual(r.total, 5)

    def test_concat_tail_shorter_than_requested(self):
        r = ChunkRing(100_000)
        r.append(np.ones(3, dtype=np.float32))
        tail = r.concat_tail(10)
        self.assertEqual(tail.shape[0], 3)

    def test_ring_drops_oldest(self):
        r = ChunkRing(5)
        r.append(np.array([1.0, 2.0, 3.0], dtype=np.float32))
        r.append(np.array([4.0, 5.0], dtype=np.float32))
        self.assertEqual(r.total, 5)
        tail = r.concat_tail(5)
        np.testing.assert_array_equal(tail, np.array([1.0, 2.0, 3.0, 4.0, 5.0], dtype=np.float32))
        r.append(np.array([6.0, 7.0], dtype=np.float32))
        # One whole chunk is evicted first; remainder may be < max until more samples arrive.
        self.assertEqual(r.total, 4)
        tail2 = r.concat_tail(5)
        np.testing.assert_array_equal(tail2, np.array([4.0, 5.0, 6.0, 7.0], dtype=np.float32))

    def test_empty_append_and_zero_tail(self):
        r = ChunkRing(1000)
        r.append(np.zeros(0, dtype=np.float32))
        self.assertEqual(r.total, 0)
        self.assertEqual(r.concat_tail(10).size, 0)


if __name__ == "__main__":
    unittest.main()
