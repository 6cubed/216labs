import os
import sqlite3

DB_PATH = os.environ.get("FACERATE_DB_PATH", "data/facerate.db")


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    schema = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()


def get_face_by_id(face_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM faces WHERE id = ?", (face_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_two_random_faces(exclude_ids=None):
    """Return two distinct random faces for a vote. exclude_ids: optional set of face ids to exclude."""
    conn = get_db()
    ids = conn.execute(
        "SELECT id FROM faces ORDER BY RANDOM() LIMIT 2"
    ).fetchall()
    conn.close()
    if len(ids) < 2:
        return None, None
    a, b = ids[0][0], ids[1][0]
    if exclude_ids and (a in exclude_ids or b in exclude_ids):
        return get_two_random_faces(exclude_ids)
    return a, b


def get_leaderboard(limit: int = 100):
    conn = get_db()
    rows = conn.execute(
        "SELECT id, filename, elo, created_at FROM faces ORDER BY elo DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def record_vote(face_a_id: int, face_b_id: int, winner_id: int):
    """Record vote and update Elo for both faces. winner_id must be face_a_id or face_b_id."""
    if winner_id not in (face_a_id, face_b_id):
        raise ValueError("winner_id must be face_a_id or face_b_id")
    conn = get_db()
    row_a = conn.execute("SELECT elo FROM faces WHERE id = ?", (face_a_id,)).fetchone()
    row_b = conn.execute("SELECT elo FROM faces WHERE id = ?", (face_b_id,)).fetchone()
    if not row_a or not row_b:
        conn.close()
        raise ValueError("face not found")
    ra, rb = row_a[0], row_b[0]
    # Elo: E_a = 1 / (1 + 10^((Rb - Ra)/400)), R_new = R + K * (S - E), K=32
    K = 32
    E_a = 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))
    E_b = 1.0 - E_a
    S_a = 1.0 if winner_id == face_a_id else 0.0
    S_b = 1.0 - S_a
    new_ra = ra + K * (S_a - E_a)
    new_rb = rb + K * (S_b - E_b)
    conn.execute(
        "INSERT INTO votes (face_a_id, face_b_id, winner_id) VALUES (?, ?, ?)",
        (face_a_id, face_b_id, winner_id),
    )
    conn.execute("UPDATE faces SET elo = ? WHERE id = ?", (new_ra, face_a_id))
    conn.execute("UPDATE faces SET elo = ? WHERE id = ?", (new_rb, face_b_id))
    conn.commit()
    conn.close()
    return {"face_a_elo": new_ra, "face_b_elo": new_rb}


def insert_face(filename: str, elo: float = 1500.0):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO faces (filename, elo) VALUES (?, ?)",
        (filename, elo),
    )
    conn.commit()
    fid = cur.lastrowid
    conn.close()
    return fid


def face_count():
    conn = get_db()
    n = conn.execute("SELECT COUNT(*) FROM faces").fetchone()[0]
    conn.close()
    return n
