import os
import sqlite3
import tempfile
import threading
import unittest
from unittest.mock import patch
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import app as activator


class DummyProc:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr


class ActivatorTests(unittest.TestCase):
    def setUp(self):
        activator._status.clear()
        activator._locks.clear()
        activator._compose_service_images.cache_clear()

    def test_single_flight_returns_queued(self):
        lock = threading.Lock()
        lock.acquire()
        activator._locks["pocket"] = lock
        try:
            with patch.object(activator, "get_app_row", return_value={"docker_service": "pocket"}):
                out = activator.start_app("pocket")
            self.assertFalse(out["ok"])
            self.assertTrue(out["queued"])
        finally:
            lock.release()

    def test_start_ready_when_service_running(self):
        with patch.object(
            activator, "get_app_row", return_value={"docker_service": "pocket"}
        ), patch.object(activator, "set_runtime_state"), patch.object(
            activator, "compose_running", return_value=True
        ), patch.object(activator, "http_upstream_ready", return_value=True), patch.object(
            activator, "try_registry_pull"
        ) as mock_pull:
            out = activator.start_app("pocket")
        self.assertTrue(out["ok"])
        self.assertEqual(out["status"]["phase"], "ready")
        mock_pull.assert_not_called()

    def test_cold_start_pulls_registry_before_compose(self):
        running_state = [False]

        def fake_running(_svc):
            return running_state[0]

        def fake_run(*_a):
            running_state[0] = True
            return DummyProc(returncode=0)

        pulls = []

        def capture_pull(svc):
            pulls.append(svc)
            return (True, "")

        with patch.object(
            activator, "get_app_row", return_value={"docker_service": "pocket"}
        ), patch.object(activator, "set_runtime_state"), patch.object(
            activator, "try_registry_pull", side_effect=capture_pull
        ), patch.object(
            activator, "run_compose", side_effect=fake_run
        ), patch.object(
            activator, "compose_running", side_effect=fake_running
        ), patch.object(activator, "http_upstream_ready", return_value=True):
            out = activator.start_app("pocket")
        self.assertTrue(out["ok"])
        self.assertEqual(pulls, ["pocket"])
        self.assertEqual(out["status"]["phase"], "ready")

    def test_missing_image_attempts_pull_then_succeeds(self):
        run_results = [
            DummyProc(returncode=1, stderr="missing image"),
            DummyProc(returncode=0),
        ]
        running_results = [False] + [True] * 30

        def fake_run_compose(*_args):
            return run_results.pop(0)

        def fake_running(_svc):
            return running_results.pop(0) if running_results else True

        with patch.object(
            activator, "get_app_row", return_value={"docker_service": "pocket"}
        ), patch.object(activator, "set_runtime_state"), patch.object(
            activator, "TRY_DOCKER_PULL", True
        ), patch.object(
            activator, "run_compose", side_effect=fake_run_compose
        ), patch.object(
            activator, "try_pull_image", return_value=DummyProc(returncode=0)
        ), patch.object(
            activator, "try_registry_pull", return_value=(True, "")
        ), patch.object(
            activator, "compose_running", side_effect=fake_running
        ), patch.object(activator, "http_upstream_ready", return_value=True):
            out = activator.start_app("pocket")
        self.assertTrue(out["ok"])
        self.assertEqual(out["status"]["phase"], "ready")

    def test_pick_lru_oldest_timestamp(self):
        self.assertEqual(
            activator.pick_lru_eviction_target(
                [
                    ("a", "a1", "2020-01-01 00:00:00"),
                    ("b", "b1", "2025-01-01 00:00:00"),
                ]
            ),
            "a",
        )

    def test_pick_lru_none_is_oldest(self):
        self.assertEqual(
            activator.pick_lru_eviction_target(
                [
                    ("a", "a1", None),
                    ("b", "b1", "2025-01-01 00:00:00"),
                ]
            ),
            "a",
        )

    def test_manifest_fallback_when_not_in_db(self):
        with patch.object(activator, "get_app_row", return_value=None), patch.object(
            activator,
            "load_manifest_for_app",
            return_value={"docker_service": "npcworld", "internal_port": 3000},
        ), patch.object(activator, "set_runtime_state"), patch.object(
            activator, "compose_running", return_value=True
        ), patch.object(activator, "http_upstream_ready", return_value=True):
            out = activator.start_app("npcworld")
        self.assertTrue(out["ok"])
        self.assertEqual(out["status"]["phase"], "ready")

    def test_manifest_never_evict_skips_lru_candidates(self):
        with patch.object(
            activator, "running_compose_services", return_value=["oneroom"]
        ), patch.object(
            activator, "docker_service_to_app_id", return_value="oneroom"
        ), patch.object(
            activator, "manifest_never_evict", return_value=True
        ), patch.object(activator, "get_last_accessed_at", return_value=None):
            c = activator.get_evictable_running_candidates()
        self.assertEqual(c, [])

    def test_ghcr_short_from_compose_image(self):
        self.assertEqual(activator.ghcr_short_from_compose_image("216labs/foo:latest"), "foo")
        self.assertEqual(
            activator.ghcr_short_from_compose_image("ghcr.io/6cubed/216labs/bar:latest"),
            "bar",
        )

    def test_registry_image_short_falls_back_to_service_name(self):
        with patch.object(activator, "_compose_service_images", return_value={}):
            self.assertEqual(activator.registry_image_short_for_service("pocket"), "pocket")

    def test_ghcr_auth_reads_token_from_db_when_env_empty(self):
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.execute(
            "CREATE TABLE env_vars (key TEXT NOT NULL, value TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT INTO env_vars (key, value) VALUES ('GHCR_TOKEN', 'tok-from-db')"
        )
        conn.execute(
            "INSERT INTO env_vars (key, value) VALUES ('GHCR_USERNAME', 'u-db')"
        )
        conn.commit()
        conn.close()
        with patch.object(activator, "DB_PATH", path), patch.dict(
            os.environ, {"GHCR_TOKEN": ""}, clear=False
        ):
            t, u, p = activator.get_effective_ghcr_auth()
        try:
            self.assertEqual(t, "tok-from-db")
            self.assertEqual(u, "u-db")
            self.assertIn("ghcr.io", p)
        finally:
            os.unlink(path)

    def test_ghcr_auth_db_prefix_used_when_env_prefix_empty(self):
        fd, path = tempfile.mkstemp(suffix=".db")
        os.close(fd)
        conn = sqlite3.connect(path)
        conn.execute(
            "CREATE TABLE env_vars (key TEXT NOT NULL, value TEXT NOT NULL)"
        )
        conn.execute(
            "INSERT INTO env_vars (key, value) VALUES ('ACTIVATOR_REGISTRY_PREFIX', 'ghcr.io/custom/prefix')"
        )
        conn.commit()
        conn.close()
        with patch.object(activator, "DB_PATH", path), patch.dict(
            os.environ,
            {"GHCR_TOKEN": "env-tok", "ACTIVATOR_REGISTRY_PREFIX": ""},
            clear=False,
        ):
            t, _u, p = activator.get_effective_ghcr_auth()
        try:
            self.assertEqual(t, "env-tok")
            self.assertEqual(p, "ghcr.io/custom/prefix")
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
