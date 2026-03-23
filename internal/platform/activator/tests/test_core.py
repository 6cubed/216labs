"""Activator helpers and safety paths (no Docker / compose)."""
from __future__ import annotations

import pathlib
import sys
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app as activator_app  # noqa: E402


class TestNormalizeAppId(unittest.TestCase):
    def test_numeric_prefix(self):
        self.assertEqual(activator_app.normalize_app_id("1pageresearch"), "1pageresearch")

    def test_hyphen(self):
        self.assertEqual(activator_app.normalize_app_id("cron-runner"), "cron-runner")

    def test_lowercases(self):
        self.assertEqual(activator_app.normalize_app_id("GermanDaily"), "germandaily")

    def test_invalid(self):
        self.assertIsNone(activator_app.normalize_app_id("../x"))
        self.assertIsNone(activator_app.normalize_app_id(""))
        self.assertIsNone(activator_app.normalize_app_id("café"))


class TestSafeWarmupDest(unittest.TestCase):
    def setUp(self):
        self._prev = activator_app.APP_HOST
        activator_app.APP_HOST = "6cubed.app"

    def tearDown(self):
        activator_app.APP_HOST = self._prev

    def test_default_when_empty(self):
        self.assertEqual(
            activator_app.safe_warmup_dest(None, "blog"),
            "https://blog.6cubed.app",
        )

    def test_accepts_matching_host(self):
        self.assertEqual(
            activator_app.safe_warmup_dest("https://blog.6cubed.app/path?q=1", "blog"),
            "https://blog.6cubed.app/path?q=1",
        )

    def test_rejects_foreign_host(self):
        self.assertEqual(
            activator_app.safe_warmup_dest("https://evil.com/phish", "blog"),
            "https://blog.6cubed.app",
        )

    def test_rejects_wrong_subdomain(self):
        self.assertEqual(
            activator_app.safe_warmup_dest("https://other.6cubed.app", "blog"),
            "https://blog.6cubed.app",
        )

    def test_rejects_http_scheme(self):
        self.assertEqual(
            activator_app.safe_warmup_dest("http://blog.6cubed.app", "blog"),
            "https://blog.6cubed.app",
        )


class TestStartAppBlock(unittest.TestCase):
    @patch.object(activator_app, "resolve_docker_service", return_value="caddy")
    def test_blocks_caddy(self, _):
        out = activator_app.start_app("anything")
        self.assertFalse(out["ok"])
        self.assertEqual(out["status"]["phase"], "failed")
        self.assertIn("infrastructure", (out["status"]["message"] or "").lower())


class TestWarmupFlask(unittest.TestCase):
    def setUp(self):
        self.app = activator_app.app
        self.app.testing = True
        self.client = self.app.test_client()

    @patch.object(activator_app, "resolve_docker_service", return_value="blog")
    def test_warmup_normalizes_mixed_case_app_param(self, _):
        r = self.client.get("/warmup?app=Blog&dest=https%3A%2F%2Fblog.6cubed.app")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"blog", r.data.lower())

    @patch.object(activator_app, "resolve_docker_service", return_value="blog")
    def test_warmup_sanitizes_dest(self, _):
        r = self.client.get("/warmup?app=blog&dest=https%3A%2F%2Fevil.com")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"https://blog.6cubed.app", r.data)
        self.assertNotIn(b"evil.com", r.data)

    def test_warmup_invalid_app_id(self):
        r = self.client.get("/warmup?app=../x")
        self.assertEqual(r.status_code, 400)


if __name__ == "__main__":
    unittest.main()
