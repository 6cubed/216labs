import os
import sqlite3

DB_PATH = os.environ.get("FACERATE_DB_PATH", "data/facerate.db")

# Attraction: 'm' = men, 'f' = women, 'all' = all. We only pair same-gender faces.
DEFAULT_ELO = 1500.0
K = 32


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _migrate(conn):
    """Add gender/excluded to faces, create face_elo, add country_code to votes."""
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(faces)")
    cols = [r[1] for r in cur.fetchall()]
    if "gender" not in cols:
        cur.execute("ALTER TABLE faces ADD COLUMN gender TEXT NOT NULL DEFAULT 'u'")
        cur.execute("ALTER TABLE faces ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_faces_gender_excluded ON faces(gender, excluded)")
    cur.execute(
        """CREATE TABLE IF NOT EXISTS face_elo (
        face_id INTEGER NOT NULL, country_code TEXT NOT NULL, elo REAL NOT NULL DEFAULT 1500,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (face_id, country_code),
        FOREIGN KEY (face_id) REFERENCES faces(id))"""
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_face_elo_country_elo ON face_elo(country_code, elo DESC)")
    if "elo" in cols:
        cur.execute("SELECT id, elo FROM faces")
        for row in cur.fetchall():
            cur.execute(
                "INSERT OR REPLACE INTO face_elo (face_id, country_code, elo, updated_at) VALUES (?, 'XX', ?, CURRENT_TIMESTAMP)",
                (row[0], row[1]),
            )
    else:
        cur.execute("SELECT id FROM faces")
        for row in cur.fetchall():
            cur.execute("INSERT OR IGNORE INTO face_elo (face_id, country_code, elo) VALUES (?, 'XX', 1500)", (row[0],))
    cur.execute("PRAGMA table_info(votes)")
    vcols = [r[1] for r in cur.fetchall()]
    if "country_code" not in vcols:
        cur.execute("ALTER TABLE votes ADD COLUMN country_code TEXT NOT NULL DEFAULT 'XX'")


def init_db():
    conn = get_db()
    # If DB already exists (e.g. old schema), migrate first so faces has gender/excluded before index creation
    if os.path.isfile(DB_PATH):
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1 FROM faces LIMIT 1")
            cur.fetchone()
            _migrate(conn)
            conn.commit()
        except sqlite3.OperationalError:
            pass
    schema = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema) as f:
        conn.executescript(f.read())
    conn.commit()
    if os.path.isfile(DB_PATH):
        try:
            _migrate(conn)
            conn.commit()
        except Exception:
            pass
    conn.close()


def get_face_by_id(face_id: int):
    conn = get_db()
    row = conn.execute("SELECT * FROM faces WHERE id = ?", (face_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def get_two_random_faces(attraction: str, country_code: str, exclude_ids=None):
    """Return two distinct random faces for a vote: same gender (both m or both f), not excluded."""
    conn = get_db()
    if attraction in ("m", "f"):
        rows = conn.execute(
            """SELECT id FROM faces WHERE excluded = 0 AND gender = ?
             ORDER BY RANDOM() LIMIT 2""",
            (attraction,),
        ).fetchall()
    else:
        # "all": pick a gender that has at least 2 faces, then two faces of that gender
        g = conn.execute(
            """SELECT gender FROM faces WHERE excluded = 0 AND gender IN ('m','f','u')
               GROUP BY gender HAVING COUNT(*) >= 2 ORDER BY RANDOM() LIMIT 1"""
        ).fetchone()
        if not g:
            conn.close()
            return None, None
        rows = conn.execute(
            "SELECT id FROM faces WHERE excluded = 0 AND gender = ? ORDER BY RANDOM() LIMIT 2",
            (g[0],),
        ).fetchall()
    conn.close()
    if len(rows) < 2:
        return None, None
    a, b = rows[0][0], rows[1][0]
    if exclude_ids and (a in exclude_ids or b in exclude_ids):
        return get_two_random_faces(attraction, country_code, exclude_ids)
    return a, b


def get_elo(face_id: int, country_code: str) -> float:
    conn = get_db()
    row = conn.execute(
        "SELECT elo FROM face_elo WHERE face_id = ? AND country_code = ?",
        (face_id, country_code),
    ).fetchone()
    conn.close()
    return float(row[0]) if row else DEFAULT_ELO


def set_elo(face_id: int, country_code: str, elo: float):
    conn = get_db()
    conn.execute(
        """INSERT INTO face_elo (face_id, country_code, elo, updated_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)
           ON CONFLICT(face_id, country_code) DO UPDATE SET elo = excluded.elo, updated_at = CURRENT_TIMESTAMP""",
        (face_id, country_code, elo),
    )
    conn.commit()
    conn.close()


def get_leaderboard(country_code: str, limit: int = 100):
    """Top faces by Elo for country (only faces with at least one vote in that country, or default 1500)."""
    conn = get_db()
    rows = conn.execute(
        """SELECT f.id, f.filename, COALESCE(e.elo, 1500) AS elo, f.created_at
           FROM faces f
           LEFT JOIN face_elo e ON e.face_id = f.id AND e.country_code = ?
           WHERE f.excluded = 0
           ORDER BY COALESCE(e.elo, 1500) DESC
           LIMIT ?""",
        (country_code, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_bottom(country_code: str, limit: int = 10):
    """Bottom faces by Elo for country."""
    conn = get_db()
    rows = conn.execute(
        """SELECT f.id, f.filename, COALESCE(e.elo, 1500) AS elo, f.created_at
           FROM faces f
           LEFT JOIN face_elo e ON e.face_id = f.id AND e.country_code = ?
           WHERE f.excluded = 0
           ORDER BY COALESCE(e.elo, 1500) ASC
           LIMIT ?""",
        (country_code, limit),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def record_vote(face_a_id: int, face_b_id: int, winner_id: int, country_code: str):
    if winner_id not in (face_a_id, face_b_id):
        raise ValueError("winner_id must be face_a_id or face_b_id")
    ra = get_elo(face_a_id, country_code)
    rb = get_elo(face_b_id, country_code)
    E_a = 1.0 / (1.0 + 10 ** ((rb - ra) / 400.0))
    E_b = 1.0 - E_a
    S_a = 1.0 if winner_id == face_a_id else 0.0
    S_b = 1.0 - S_a
    new_ra = ra + K * (S_a - E_a)
    new_rb = rb + K * (S_b - E_b)
    conn = get_db()
    conn.execute(
        "INSERT INTO votes (face_a_id, face_b_id, winner_id, country_code) VALUES (?, ?, ?, ?)",
        (face_a_id, face_b_id, winner_id, country_code),
    )
    conn.commit()
    conn.close()
    set_elo(face_a_id, country_code, new_ra)
    set_elo(face_b_id, country_code, new_rb)
    return {"face_a_elo": new_ra, "face_b_elo": new_rb}


def insert_face(filename: str, gender: str = "u", excluded: int = 0):
    conn = get_db()
    cur = conn.execute(
        "INSERT INTO faces (filename, gender, excluded) VALUES (?, ?, ?)",
        (filename, gender, excluded),
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


def get_countries_with_votes():
    """Return list of country codes that have at least one vote (for leaderboard dropdown)."""
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT country_code FROM votes WHERE country_code != 'XX' ORDER BY country_code"
    ).fetchall()
    conn.close()
    return [r[0] for r in rows]
