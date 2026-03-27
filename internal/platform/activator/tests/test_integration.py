"""Integration-style tests for activator fallback and warmup flow."""
from __future__ import annotations

import json
import pathlib
import sqlite3
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import app as activator_app  # noqa: E402


class TestManifestFallbackIntegration(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.project_root = pathlib.Path(self.tempdir.name)
        self.db_path = self.project_root / "216labs.db"
        self._init_db()

        self.prev_project_root = activator_app.PROJECT_ROOT
        self.prev_db_path = activator_app.DB_PATH
        self.prev_app_host = activator_app.APP_HOST
        activator_app.PROJECT_ROOT = str(self.project_root)
        activator_app.DB_PATH = str(self.db_path)
        activator_app.APP_HOST = "6cubed.app"
        activator_app._manifest_files_index.cache_clear()
        activator_app._status.clear()
        activator_app._locks.clear()

        activator_app.app.testing = True
        self.client = activator_app.app.test_client()

    def tearDown(self):
        activator_app.PROJECT_ROOT = self.prev_project_root
        activator_app.DB_PATH = self.prev_db_path
        activator_app.APP_HOST = self.prev_app_host
        activator_app._manifest_files_index.cache_clear()
        self.tempdir.cleanup()

    def _init_db(self):
        conn = sqlite3.connect(self.db_path)
        conn.execute(
            "CREATE TABLE apps (id TEXT PRIMARY KEY, docker_service TEXT, runtime_status TEXT, last_runtime_error TEXT, last_started_at TEXT, last_accessed_at TEXT)"
        )
        conn.commit()
        conn.close()

    def _write_manifest(self, rel_dir: str, app_id: str, docker_service: str, port: int = 3000):
        target = self.project_root / rel_dir
        target.mkdir(parents=True, exist_ok=True)
        (target / "manifest.json").write_text(
            json.dumps(
                {
                    "id": app_id,
                    "docker_service": docker_service,
                    "internal_port": port,
                }
            ),
            encoding="utf-8",
        )
        activator_app._manifest_files_index.cache_clear()

    def test_nested_manifest_is_resolved_when_db_missing(self):
        self._write_manifest("products/org-platform/vc", "vc", "vc", 3000)
        with patch.object(activator_app, "set_runtime_state"), patch.object(
            activator_app, "compose_running", return_value=True
        ), patch.object(activator_app, "http_upstream_ready", return_value=True):
            out = activator_app.start_app("vc")
        self.assertTrue(out["ok"])
        self.assertEqual(out["status"]["docker_service"], "vc")
        self.assertEqual(out["status"]["phase"], "ready")

    def test_warmup_unknown_app_returns_not_found_message(self):
        r = self.client.get("/warmup?app=missing")
        self.assertEqual(r.status_code, 404)
        self.assertIn(b"Unknown app", r.data)

    def test_warmup_for_nested_manifest_app_renders_page(self):
        self._write_manifest("products/org-platform/vc", "vc", "vc", 3000)
        r = self.client.get("/warmup?app=vc&dest=https%3A%2F%2Fvc.6cubed.app")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"Warming up vc", r.data)
        self.assertIn(b"https://vc.6cubed.app", r.data)

    def test_manifest_without_http_port_is_rejected(self):
        self._write_manifest("products/org-platform/worker", "worker", "worker", 0)
        self.assertIsNone(activator_app.resolve_docker_service("worker"))


if __name__ == "__main__":
    unittest.main()
