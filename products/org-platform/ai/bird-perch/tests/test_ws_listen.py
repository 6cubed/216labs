"""WebSocket /ws/listen behaviour (live listen) with BIRDPERCH_MOCK and patched decode."""

from __future__ import annotations

import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

os.environ.setdefault("BIRDPERCH_MOCK", "1")

from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


def _mono_chunk(samples: int = 12_000) -> np.ndarray:
    return (0.05 * np.sin(np.linspace(0, 80, samples, endpoint=False))).astype(np.float32)


class TestWsListen(unittest.TestCase):
    def test_hello_and_ping_pong(self):
        with TestClient(app) as client:
            with client.websocket_connect("/ws/listen") as ws:
                hello = ws.receive_json()
                self.assertEqual(hello["type"], "hello")
                self.assertIn("target_sr", hello)
                self.assertIn("infer_interval_ms", hello)

                ws.send_text('{"type":"ping"}')
                pong = ws.receive_json()
                self.assertEqual(pong["type"], "pong")

    @patch("app.main.STREAM_INFER_SEC", 0.35)
    @patch("app.main.load_audio_mono", return_value=_mono_chunk(12_000))
    def test_binary_chunk_yields_tick_with_top_species(self, _decode):
        with TestClient(app) as client:
            with client.websocket_connect("/ws/listen") as ws:
                self.assertEqual(ws.receive_json()["type"], "hello")
                ws.send_bytes(b"fake-webm")
                msg = ws.receive_json()
                self.assertEqual(msg["type"], "tick")
                self.assertIn("buffer_samples", msg)
                self.assertGreater(msg["buffer_samples"], 0)
                self.assertIsInstance(msg["top"], dict)
                self.assertIn("species", msg["top"])
                self.assertIsInstance(msg["top5"], list)
                self.assertGreaterEqual(len(msg["top5"]), 1)

    @patch("app.main.STREAM_MAX_CHUNK", 32)
    def test_oversized_chunk_returns_error(self):
        with TestClient(app) as client:
            with client.websocket_connect("/ws/listen") as ws:
                self.assertEqual(ws.receive_json()["type"], "hello")
                ws.send_bytes(b"x" * 64)
                err = ws.receive_json()
                self.assertEqual(err["type"], "error")
                self.assertIn("too large", err["detail"])

    @patch("app.main.STREAM_INFER_SEC", 0.35)
    def test_decode_recovers_when_accumulated_webm_becomes_decodable(self):
        """Incomplete fragments are ignored until decode succeeds (real WebM from MediaRecorder)."""
        calls = {"n": 0}

        def load_side(data: bytes, sr: int) -> np.ndarray:
            calls["n"] += 1
            if calls["n"] < 2:
                raise RuntimeError("incomplete webm")
            return _mono_chunk(12_000)

        with patch("app.main.load_audio_mono", side_effect=load_side):
            with TestClient(app) as client:
                with client.websocket_connect("/ws/listen") as ws:
                    self.assertEqual(ws.receive_json()["type"], "hello")
                    ws.send_bytes(b"frag1")
                    ws.send_bytes(b"frag2")
                    msg = ws.receive_json()
                    self.assertEqual(msg["type"], "tick")
                    self.assertGreater(msg["buffer_samples"], 0)


if __name__ == "__main__":
    unittest.main()
