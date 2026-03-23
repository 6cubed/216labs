import os
import sqlite3
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
DATABASE = os.environ.get("PRIORS_DATABASE_PATH", str(BASE_DIR / "data/database.db"))


def get_db():
    db_path = Path(DATABASE)
    db_path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    db = get_db()
    with open(BASE_DIR / "schema.sql", "r", encoding="utf-8") as schema_file:
        db.executescript(schema_file.read())
    # Migrate: add author_name if the column doesn't exist yet
    cols = {row[1] for row in db.execute("PRAGMA table_info(priors)")}
    if "author_name" not in cols:
        db.execute("ALTER TABLE priors ADD COLUMN author_name TEXT")
    db.commit()
    db.close()
