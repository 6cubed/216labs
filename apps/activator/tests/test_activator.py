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
        ):
            out = activator.start_app("pocket")
        self.assertTrue(out["ok"])
        self.assertEqual(out["status"]["phase"], "ready")

    def test_missing_image_attempts_pull_then_succeeds(self):
        run_results = [
            DummyProc(returncode=1, stderr="missing image"),
            DummyProc(returncode=0),
        ]
        running_results = [False, True]

        def fake_run_compose(*_args):
            return run_results.pop(0)

        def fake_running(_svc):
            return running_results.pop(0)

        with patch.object(
            activator, "get_app_row", return_value={"docker_service": "pocket"}
        ), patch.object(activator, "set_runtime_state"), patch.object(
            activator, "TRY_DOCKER_PULL", True
        ), patch.object(
            activator, "run_compose", side_effect=fake_run_compose
        ), patch.object(
            activator, "try_pull_image", return_value=DummyProc(returncode=0)
        ), patch.object(
            activator, "compose_running", side_effect=fake_running
        ):
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


if __name__ == "__main__":
    unittest.main()
