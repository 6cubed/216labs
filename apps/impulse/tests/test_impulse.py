import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app import app as flask_app, haversine_km, load_offers  # noqa: E402


class TestHaversine(unittest.TestCase):
    def test_zurich_to_berlin(self):
        zrh = (47.3769, 8.5417)
        ber = (52.52, 13.405)
        km = haversine_km(zrh[0], zrh[1], ber[0], ber[1])
        self.assertTrue(650 < km < 670)


class TestOffers(unittest.TestCase):
    def test_load_offers(self):
        offers = load_offers()
        self.assertGreaterEqual(len(offers), 10)
        self.assertTrue(all("lat" in o and "lng" in o for o in offers))


class TestApi(unittest.TestCase):
    def setUp(self):
        flask_app.config["TESTING"] = True
        self.client = flask_app.test_client()

    def test_requires_lat_lng(self):
        r = self.client.get("/api/offers")
        self.assertEqual(r.status_code, 400)

    def test_sorted_by_distance(self):
        lat, lng = 47.3769, 8.5417
        r = self.client.get(f"/api/offers?lat={lat}&lng={lng}&radius_km=500")
        self.assertEqual(r.status_code, 200)
        data = json.loads(r.data)
        offers = data["offers"]
        self.assertGreaterEqual(len(offers), 2)
        dists = [o["distance_km"] for o in offers]
        self.assertEqual(dists, sorted(dists))

    def test_health(self):
        r = self.client.get("/health")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(json.loads(r.data)["ok"])


if __name__ == "__main__":
    unittest.main()
