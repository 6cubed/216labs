import os
import unittest
from pathlib import Path

os.environ["AVATAR_OPENAI_API_KEY"] = ""

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as avatar_app


class AvatarTests(unittest.TestCase):
    def setUp(self):
        avatar_app.app.config["TESTING"] = True
        self.client = avatar_app.app.test_client()

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        j = r.get_json()
        self.assertTrue(j.get("ok"))
        self.assertEqual(j.get("app"), "avatar")

    def test_index(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"Avatar", r.data)

    def test_turn_requires_messages(self):
        r = self.client.post("/api/turn", json={})
        self.assertEqual(r.status_code, 400)

    def test_turn_without_key_returns_text(self):
        r = self.client.post(
            "/api/turn",
            json={"messages": [{"role": "user", "content": "Hello"}]},
        )
        self.assertEqual(r.status_code, 200)
        j = r.get_json()
        self.assertIn("reply", j)
        self.assertIn("API key", j["reply"])


if __name__ == "__main__":
    unittest.main()
