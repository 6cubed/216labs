import base64
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.audio_io import load_audio_mono  # noqa: E402


# Tiny 0.25s sine wave encoded as WebM/Opus (MediaRecorder-style container).
# Generated via:
#   ffmpeg -f lavfi -i "sine=frequency=1000:duration=0.25" -c:a libopus -b:a 48k -ar 48000 -ac 1 -f webm out.webm
WEBM_OPUS_BASE64 = (
    "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"
)


class TestBirdPerchUploadDecode(unittest.TestCase):
    def test_mediarecorder_webm_opus_decodes_via_ffmpeg_fallback(self):
        raw = base64.b64decode(WEBM_OPUS_BASE64)

        # Create a known-good WAV payload for the ffmpeg fallback to output.
        import io

        import soundfile as sf
        import numpy as np

        sr = 48_000
        t = np.linspace(0, 0.25, int(sr * 0.25), endpoint=False, dtype=np.float32)
        y = 0.1 * np.sin(2 * np.pi * 1000.0 * t).astype(np.float32)
        wav_buf = io.BytesIO()
        sf.write(wav_buf, y, sr, format="WAV", subtype="FLOAT")
        wav_bytes = wav_buf.getvalue()

        import soundfile as real_sf

        # Force the initial direct soundfile decode to fail (as it does for WebM),
        # then ensure the ffmpeg fallback produces decodable WAV bytes.
        with patch("app.audio_io.sf.read", side_effect=[Exception("Format not recognised"), real_sf.read]) as _sf_read:
            with patch("app.audio_io._decode_via_ffmpeg", return_value=wav_bytes) as _ff:
                out = load_audio_mono(raw, target_sr=sr)

        self.assertGreater(out.shape[0], 1000)
        self.assertTrue(np.isfinite(out).all())
        self.assertGreater(float(np.max(np.abs(out))), 0.001)
        _ff.assert_called_once()


if __name__ == "__main__":
    unittest.main()

