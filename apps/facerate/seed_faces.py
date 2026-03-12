"""
Download 1000 AI-generated faces from thispersondoesnotexist.com and seed the DB.

Each request to the site returns a new face. We throttle to ~1 req/sec.
Run once: python seed_faces.py
"""
import os
import time
import requests

from database import init_db, insert_face, face_count

BASE_URL = "https://thispersondoesnotexist.com/"
OUTPUT_DIR = os.environ.get(
    "FACERATE_FACES_DIR",
    os.path.join(os.path.dirname(__file__), "static", "faces"),
)
NUM_FACES = int(os.environ.get("FACERATE_SEED_COUNT", "1000"))
DELAY_SEC = float(os.environ.get("FACERATE_SEED_DELAY", "1.2"))


def download_one(index: int) -> bool:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    filename = f"{index:04d}.jpg"
    path = os.path.join(OUTPUT_DIR, filename)
    if os.path.isfile(path):
        return True
    try:
        r = requests.get(BASE_URL, params={"t": index}, timeout=15)
        r.raise_for_status()
        with open(path, "wb") as f:
            f.write(r.content)
        return True
    except Exception as e:
        print(f"  Failed {filename}: {e}")
        return False


def main():
    init_db()
    existing = face_count()
    if existing >= NUM_FACES:
        print(f"Already have {existing} faces. Done.")
        return
    to_fetch = NUM_FACES - existing
    print(f"Fetching {to_fetch} faces (target {NUM_FACES}, have {existing})...")
    start = existing
    # First 2 with minimal delay so app works quickly; then throttle
    fast_until = min(start + 2, NUM_FACES)
    for i in range(start + 1, NUM_FACES + 1):
        if download_one(i):
            insert_face(f"{i:04d}.jpg")
            if i % 50 == 0:
                print(f"  {i}/{NUM_FACES}")
        delay = 0.3 if i < fast_until else DELAY_SEC
        time.sleep(delay)
    print(f"Done. Total faces: {face_count()}")


if __name__ == "__main__":
    main()
