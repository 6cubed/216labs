"""Unit tests for FaceRate DB / Elo (uses temp SQLite)."""
import os
import tempfile
import unittest

import database as db


class TestFacerateDb(unittest.TestCase):
    def setUp(self):
        self._fd, self.path = tempfile.mkstemp(suffix=".db")
        os.close(self._fd)
        self._orig_path = db.DB_PATH
        db.DB_PATH = self.path
        db.init_db()

    def tearDown(self):
        db.DB_PATH = self._orig_path
        try:
            os.remove(self.path)
        except OSError:
            pass

    def test_vote_updates_elo_and_winner_gains(self):
        a = db.insert_face("t1.jpg", gender="m", excluded=0)
        b = db.insert_face("t2.jpg", gender="m", excluded=0)
        cc = "US"
        ra0 = db.get_elo(a, cc)
        rb0 = db.get_elo(b, cc)
        self.assertEqual(ra0, 1500.0)
        self.assertEqual(rb0, 1500.0)
        db.record_vote(a, b, a, cc)
        ra1 = db.get_elo(a, cc)
        rb1 = db.get_elo(b, cc)
        self.assertGreater(ra1, ra0)
        self.assertLess(rb1, rb0)

    def test_unknown_gender_migrated_to_m_or_f(self):
        db.insert_face("u1.jpg", gender="u", excluded=0)
        db.init_db()
        conn = db.get_db()
        g = conn.execute("SELECT gender FROM faces WHERE filename = 'u1.jpg'").fetchone()[0]
        conn.close()
        self.assertIn(g, ("m", "f"))


if __name__ == "__main__":
    unittest.main()
