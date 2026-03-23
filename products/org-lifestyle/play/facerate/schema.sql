-- Faces: gender 'm'/'f'/'u' (unknown); excluded=1 for under-18-looking (not shown in voting)
CREATE TABLE IF NOT EXISTS faces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT UNIQUE NOT NULL,
    gender TEXT NOT NULL DEFAULT 'u',
    excluded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Legacy elo column (kept for migration); per-country elo is in face_elo
-- SQLite doesn't have IF NOT EXISTS for columns; migration adds it if missing

-- Per-country Elo: one row per (face, country). Default 1500 when missing.
CREATE TABLE IF NOT EXISTS face_elo (
    face_id INTEGER NOT NULL,
    country_code TEXT NOT NULL,
    elo REAL NOT NULL DEFAULT 1500,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (face_id, country_code),
    FOREIGN KEY (face_id) REFERENCES faces(id)
);

CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    face_a_id INTEGER NOT NULL,
    face_b_id INTEGER NOT NULL,
    winner_id INTEGER NOT NULL,
    country_code TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (face_a_id) REFERENCES faces(id),
    FOREIGN KEY (face_b_id) REFERENCES faces(id),
    FOREIGN KEY (winner_id) REFERENCES faces(id)
);

CREATE INDEX IF NOT EXISTS idx_faces_gender_excluded ON faces(gender, excluded);
CREATE INDEX IF NOT EXISTS idx_face_elo_country_elo ON face_elo(country_code, elo DESC);
CREATE INDEX IF NOT EXISTS idx_votes_created ON votes(created_at);
