import os
import re
import tempfile
import unittest
from pathlib import Path

os.environ["MEDIATE_SECRET_KEY"] = "test-session-secret"

_tmp = tempfile.mkdtemp()
os.environ["MEDIATE_DATA_DIR"] = _tmp

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import app as mediate


class MediateTests(unittest.TestCase):
    def setUp(self):
        mediate.init_db()
        mediate.app.config["TESTING"] = True
        self.client = mediate.app.test_client()

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"mediate", r.data)

    def test_create_room_and_host_room_page(self):
        r = self.client.post("/create", data={"goal": "Resolve dispute"})
        self.assertEqual(r.status_code, 200)
        self.assertIn(b"Invite link", r.data)
        with self.client.session_transaction() as sess:
            rid = sess.get("mediate_room")
            party = sess.get("mediate_party")
        self.assertEqual(party, "a")
        self.assertIsNotNone(rid)
        r2 = self.client.get(f"/room/{rid}")
        self.assertEqual(r2.status_code, 200)
        self.assertIn(b"Party A", r2.data)

    def test_invite_guest_and_second_blocked(self):
        r = self.client.post("/create", data={})
        self.assertEqual(r.status_code, 200)
        text = r.get_data(as_text=True)
        m = re.search(r"/invite/([a-f0-9]+)", text)
        self.assertIsNotNone(m, "invite URL in created page")
        token = m.group(1)

        guest = mediate.app.test_client()
        r_g = guest.get(f"/invite/{token}", follow_redirects=True)
        self.assertEqual(r_g.status_code, 200)
        with guest.session_transaction() as sess:
            self.assertEqual(sess.get("mediate_party"), "b")

        intruder = mediate.app.test_client()
        r_i = intruder.get(f"/invite/{token}")
        self.assertEqual(r_i.status_code, 403)

    def test_api_send_without_key_returns_placeholder(self):
        old_key = os.environ.pop("MEDIATE_OPENAI_API_KEY", None)
        try:
            r = self.client.post("/create", data={})
            self.assertEqual(r.status_code, 200)
            with self.client.session_transaction() as sess:
                rid = sess["mediate_room"]
            r2 = self.client.post(
                f"/api/room/{rid}/send",
                json={"text": "Hello there"},
                content_type="application/json",
            )
            self.assertEqual(r2.status_code, 200)
            data = r2.get_json()
            self.assertTrue(data.get("ok"))
            self.assertIn("Mediator unavailable", data.get("mediated_text", ""))
        finally:
            if old_key is not None:
                os.environ["MEDIATE_OPENAI_API_KEY"] = old_key


if __name__ == "__main__":
    unittest.main()
