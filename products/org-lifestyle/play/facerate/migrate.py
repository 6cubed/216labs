"""One-time migration: add gender, excluded to faces; create face_elo; add country_code to votes."""
import sqlite3
import os

DB_PATH = os.environ.get("FACERATE_DB_PATH", "data/facerate.db")


def run():
    if not os.path.isfile(DB_PATH):
        return
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Check if faces has 'gender' column
    cur.execute("PRAGMA table_info(faces)")
    cols = [r[1] for r in cur.fetchall()]
    if "gender" not in cols:
        cur.execute("ALTER TABLE faces ADD COLUMN gender TEXT NOT NULL DEFAULT 'u'")
        cur.execute("ALTER TABLE faces ADD COLUMN excluded INTEGER NOT NULL DEFAULT 0")

    # Create face_elo if not exists (schema.sql may have created it)
    cur.execute(
        """CREATE TABLE IF NOT EXISTS face_elo (
        face_id INTEGER NOT NULL,
        country_code TEXT NOT NULL,
        elo REAL NOT NULL DEFAULT 1500,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (face_id, country_code),
        FOREIGN KEY (face_id) REFERENCES faces(id)
    )"""
    )
    cur.execute("CREATE INDEX IF NOT EXISTS idx_face_elo_country_elo ON face_elo(country_code, elo DESC)")

    # Backfill face_elo from faces.elo for legacy country (if faces has elo column)
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
            cur.execute(
                "INSERT OR IGNORE INTO face_elo (face_id, country_code, elo) VALUES (?, 'XX', 1500)",
                (row[0],),
            )

    # Add country_code to votes if missing
    cur.execute("PRAGMA table_info(votes)")
    vcols = [r[1] for r in cur.fetchall()]
    if "country_code" not in vcols:
        cur.execute("ALTER TABLE votes ADD COLUMN country_code TEXT NOT NULL DEFAULT 'XX'")
        cur.execute("UPDATE votes SET country_code = 'XX' WHERE country_code IS NULL OR country_code = ''")

    conn.commit()
    conn.close()


if __name__ == "__main__":
    run()
    print("Migration done.")
