import json
import os
import sqlite3

DB_PATH = os.environ.get("ONEPAGE_DB_PATH", "data/1pageresearch.db")


def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    schema = os.path.join(os.path.dirname(__file__), "schema.sql")
    with open(schema) as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()


def get_all_reports():
    conn = get_db()
    rows = conn.execute(
        "SELECT * FROM reports ORDER BY created_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_report_by_slug(slug):
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM reports WHERE slug = ?", (slug,)
    ).fetchone()
    conn.close()
    if row is None:
        return None
    report = dict(row)
    report["stats"] = json.loads(report.get("stats_json") or "[]")
    return report


def insert_report(data: dict):
    conn = get_db()
    conn.execute(
        """INSERT OR REPLACE INTO reports
           (slug, title, intervention, outcome, source_communities,
            sample_size, effect_summary, p_value, p_value_display,
            effect_size, effect_size_label, confidence_interval,
            stats_json, report_markdown, tags)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            data["slug"],
            data["title"],
            data["intervention"],
            data["outcome"],
            data["source_communities"],
            data.get("sample_size"),
            data["effect_summary"],
            data.get("p_value"),
            data.get("p_value_display"),
            data.get("effect_size"),
            data.get("effect_size_label"),
            data.get("confidence_interval"),
            json.dumps(data.get("stats", [])),
            data["report_markdown"],
            data.get("tags", ""),
        ),
    )
    conn.commit()
    conn.close()
