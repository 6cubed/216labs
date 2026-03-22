# AngelWatcher — early-stage watchlist with valuation ceiling + weighted signals
from __future__ import annotations

import json
import os
import sqlite3
from pathlib import Path

import flask

from seed_data import SEED

app = flask.Flask(__name__)

DATA_DIR = os.environ.get("ANGELWATCHER_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "angelwatcher.db"

# Max implied post-money valuation (USD) for this product focus
VALUATION_CEILING_USD = 10_000_000

# slug -> { label, weight } — higher = stronger signal for sorting
SIGNAL_CATALOG: dict[str, dict[str, object]] = {
    "xoogler_founded": {"label": "Xoogler on founding team", "weight": 3},
    "tier1_vc": {"label": "Tier-1 VC affiliation / intro", "weight": 4},
    "yc_batch": {"label": "Y Combinator batch", "weight": 4},
    "repeat_founder": {"label": "Repeat / exited founder", "weight": 3},
    "ex_faang": {"label": "FAANG/MANG alumni (non-Google)", "weight": 2},
    "technical_cofounder": {"label": "Strong technical co-founder", "weight": 2},
    "accelerator": {"label": "Top accelerator (a16z, Techstars, …)", "weight": 2},
    "hot_sector": {"label": "Hot sector (AI / infra / devtools)", "weight": 1},
}


def get_db() -> sqlite3.Connection:
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def score_for_slugs(slugs: list[str]) -> int:
    total = 0
    for s in slugs:
        meta = SIGNAL_CATALOG.get(s)
        if meta:
            total += int(meta["weight"])
    return total


def init_db() -> None:
    with get_db() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS companies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                one_liner TEXT NOT NULL DEFAULT '',
                sector TEXT NOT NULL DEFAULT '',
                stage TEXT NOT NULL DEFAULT 'Pre-seed',
                valuation_usd INTEGER,
                website_url TEXT NOT NULL DEFAULT '',
                notes TEXT NOT NULL DEFAULT '',
                signal_slugs TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX IF NOT EXISTS idx_companies_valuation ON companies(valuation_usd);
            """
        )
        n = conn.execute("SELECT COUNT(*) AS c FROM companies").fetchone()["c"]
        if n == 0:
            for row in SEED:
                conn.execute(
                    """
                    INSERT INTO companies (
                        name, one_liner, sector, stage, valuation_usd,
                        website_url, notes, signal_slugs
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        row["name"],
                        row["one_liner"],
                        row["sector"],
                        row["stage"],
                        row["valuation_usd"],
                        row["website_url"],
                        row["notes"],
                        json.dumps(row["signal_slugs"]),
                    ),
                )


def row_to_company(r: sqlite3.Row) -> dict:
    slugs = json.loads(r["signal_slugs"] or "[]")
    return {
        "id": r["id"],
        "name": r["name"],
        "one_liner": r["one_liner"],
        "sector": r["sector"],
        "stage": r["stage"],
        "valuation_usd": r["valuation_usd"],
        "website_url": r["website_url"],
        "notes": r["notes"],
        "signal_slugs": slugs,
        "signals": [
            {"slug": s, **SIGNAL_CATALOG[s]}
            for s in slugs
            if s in SIGNAL_CATALOG
        ],
        "score": score_for_slugs(slugs),
        "created_at": r["created_at"],
        "updated_at": r["updated_at"],
    }


@app.route("/healthz")
def healthz():
    return {"ok": True, "service": "angelwatcher"}


@app.route("/api/signals")
def api_signals():
    return {
        "ceiling_usd": VALUATION_CEILING_USD,
        "signals": [
            {"slug": k, "label": v["label"], "weight": v["weight"]}
            for k, v in sorted(
                SIGNAL_CATALOG.items(), key=lambda x: (-int(x[1]["weight"]), x[0])
            )
        ],
    }


@app.route("/api/companies", methods=["GET", "POST"])
def api_companies():
    init_db()
    if flask.request.method == "GET":
        only_under = flask.request.args.get("under_ceiling", "1") == "1"
        signal_filter = flask.request.args.get("signal")  # slug or empty

        with get_db() as conn:
            rows = conn.execute(
                "SELECT * FROM companies ORDER BY updated_at DESC"
            ).fetchall()
        out = [row_to_company(r) for r in rows]
        if only_under:
            out = [
                c
                for c in out
                if c["valuation_usd"] is None
                or c["valuation_usd"] <= VALUATION_CEILING_USD
            ]
        if signal_filter:
            out = [c for c in out if signal_filter in c["signal_slugs"]]
        out.sort(key=lambda c: (-c["score"], c["name"].lower()))
        return {"companies": out, "ceiling_usd": VALUATION_CEILING_USD}

    payload = flask.request.get_json(silent=True) or {}
    name = (payload.get("name") or "").strip()
    if not name:
        return {"error": "name is required"}, 400
    slugs = payload.get("signal_slugs") or []
    if not isinstance(slugs, list):
        return {"error": "signal_slugs must be a list"}, 400
    slugs = [s for s in slugs if isinstance(s, str) and s in SIGNAL_CATALOG]
    valuation = payload.get("valuation_usd")
    if valuation is not None and valuation != "":
        try:
            valuation = int(valuation)
        except (TypeError, ValueError):
            return {"error": "valuation_usd must be an integer or null"}, 400
    else:
        valuation = None

    one_liner = (payload.get("one_liner") or "").strip()
    sector = (payload.get("sector") or "").strip()
    stage = (payload.get("stage") or "Pre-seed").strip()
    website_url = (payload.get("website_url") or "").strip()
    notes = (payload.get("notes") or "").strip()

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO companies (
                name, one_liner, sector, stage, valuation_usd,
                website_url, notes, signal_slugs
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                one_liner,
                sector,
                stage,
                valuation,
                website_url,
                notes,
                json.dumps(slugs),
            ),
        )
        cid = cur.lastrowid
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (cid,)
        ).fetchone()
    return row_to_company(row), 201


@app.route("/api/companies/<int:cid>", methods=["PATCH", "DELETE"])
def api_company_one(cid: int):
    init_db()
    if flask.request.method == "DELETE":
        with get_db() as conn:
            conn.execute("DELETE FROM companies WHERE id = ?", (cid,))
        return "", 204

    payload = flask.request.get_json(silent=True) or {}
    fields: list[str] = []
    values: list = []

    if "name" in payload:
        name = (payload.get("name") or "").strip()
        if not name:
            return {"error": "name cannot be empty"}, 400
        fields.append("name = ?")
        values.append(name)
    if "one_liner" in payload:
        fields.append("one_liner = ?")
        values.append((payload.get("one_liner") or "").strip())
    if "sector" in payload:
        fields.append("sector = ?")
        values.append((payload.get("sector") or "").strip())
    if "stage" in payload:
        fields.append("stage = ?")
        values.append((payload.get("stage") or "").strip())
    if "website_url" in payload:
        fields.append("website_url = ?")
        values.append((payload.get("website_url") or "").strip())
    if "notes" in payload:
        fields.append("notes = ?")
        values.append((payload.get("notes") or "").strip())
    if "valuation_usd" in payload:
        v = payload["valuation_usd"]
        if v is None or v == "":
            fields.append("valuation_usd = ?")
            values.append(None)
        else:
            try:
                fields.append("valuation_usd = ?")
                values.append(int(v))
            except (TypeError, ValueError):
                return {"error": "valuation_usd must be an integer or null"}, 400
    if "signal_slugs" in payload:
        slugs = payload["signal_slugs"]
        if not isinstance(slugs, list):
            return {"error": "signal_slugs must be a list"}, 400
        slugs = [s for s in slugs if isinstance(s, str) and s in SIGNAL_CATALOG]
        fields.append("signal_slugs = ?")
        values.append(json.dumps(slugs))

    if not fields:
        return {"error": "no fields to update"}, 400
    fields.append("updated_at = datetime('now')")
    values.append(cid)

    with get_db() as conn:
        conn.execute(
            f"UPDATE companies SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        row = conn.execute(
            "SELECT * FROM companies WHERE id = ?", (cid,)
        ).fetchone()
        if not row:
            return {"error": "not found"}, 404
    return row_to_company(row)


@app.route("/")
def index():
    init_db()
    return flask.render_template("index.html", ceiling_m=VALUATION_CEILING_USD // 1_000_000)
