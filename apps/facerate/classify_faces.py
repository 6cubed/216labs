"""
Set gender and excluded (under-18-looking) for faces using DeepFace.
Run after seeding: pip install deepface, then python classify_faces.py

- gender: 'm' or 'f' (required for Men/Women attraction filters)
- excluded: 1 if estimated age < 18, else 0 (faces excluded from voting)
"""
import os
import sys

FACES_DIR = os.environ.get(
    "FACERATE_FACES_DIR",
    os.path.join(os.path.dirname(__file__), "static", "faces"),
)

try:
    from deepface import DeepFace
except ImportError:
    print("Install deepface: pip install deepface", file=sys.stderr)
    sys.exit(1)

from database import get_db

# Ensure DB and schema exist
import database
database.init_db()


def classify_one(path: str) -> tuple:
    """Return (gender, excluded). gender 'm'/'f'; excluded 1 if age < 18 else 0."""
    try:
        obj = DeepFace.analyze(path, actions=["gender", "age"], enforce_detection=False)
        if not obj or not isinstance(obj, list):
            return "u", 0
        o = obj[0]
        gender = "m" if (o.get("dominant_gender") or "").lower() == "man" else "f"
        age = float(o.get("age") or 25)
        excluded = 1 if age < 18 else 0
        return gender, excluded
    except Exception:
        return "u", 0


def main():
    conn = get_db()
    rows = conn.execute("SELECT id, filename FROM faces WHERE gender = 'u' OR excluded = 0").fetchall()
    conn.close()
    total = len(rows)
    for i, (face_id, filename) in enumerate(rows):
        path = os.path.join(FACES_DIR, filename)
        if not os.path.isfile(path):
            continue
        gender, excluded = classify_one(path)
        conn = get_db()
        conn.execute(
            "UPDATE faces SET gender = ?, excluded = ? WHERE id = ?",
            (gender, excluded, face_id),
        )
        conn.commit()
        conn.close()
        if (i + 1) % 50 == 0:
            print(f"  {i + 1}/{total}")
    print("Done.")


if __name__ == "__main__":
    main()
