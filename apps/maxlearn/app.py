# MaxLearn — Tinder for Wikipedia rabbit holes
from __future__ import annotations

import os
import random
import sqlite3
import time
import uuid
from pathlib import Path

import flask
import requests

app = flask.Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("MAXLEARN_SECRET_KEY", "dev-secret-change-in-prod")

DATA_DIR = os.environ.get("MAXLEARN_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "maxlearn.db"

WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "MaxLearn/1.0 (https://maxlearn.6cubed.app; educational)"


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS snippets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                page_id INTEGER UNIQUE NOT NULL,
                title TEXT NOT NULL,
                extract TEXT NOT NULL,
                wiki_url TEXT NOT NULL,
                categories TEXT,
                source_page_id INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_snippets_source ON snippets(source_page_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_snippets_page_id ON snippets(page_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                snippet_id INTEGER NOT NULL REFERENCES snippets(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_likes_session ON likes(session_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_likes_snippet ON likes(snippet_id)")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS skips (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                snippet_id INTEGER NOT NULL REFERENCES snippets(id),
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_skips_session ON skips(session_id)")


def _wiki_get(params: dict) -> dict:
    params.setdefault("format", "json")
    params.setdefault("origin", "*")
    r = requests.get(
        WIKI_API,
        params=params,
        headers={"User-Agent": USER_AGENT},
        timeout=15,
    )
    r.raise_for_status()
    return r.json()


def fetch_random_page_ids(limit: int = 500) -> list[int]:
    data = _wiki_get({
        "action": "query",
        "list": "random",
        "rnnamespace": 0,
        "rnlimit": min(limit, 500),
        "rnfilterredir": "nonredirects",
    })
    pages = data.get("query", {}).get("random", [])
    return [p["id"] for p in pages]


def fetch_extract_and_categories(page_ids: list[int]) -> list[dict]:
    if not page_ids:
        return []
    page_ids_str = "|".join(str(pid) for pid in page_ids[:50])
    data = _wiki_get({
        "action": "query",
        "pageids": page_ids_str,
        "prop": "extracts|info|categories",
        "exintro": 1,
        "explaintext": 1,
        "exsentences": 4,
        "exchars": 500,
        "inprop": "url",
        "cllimit": 5,
    })
    pages = data.get("query", {}).get("pages", {})
    out = []
    for pid_str, p in pages.items():
        if "missing" in p:
            continue
        extract = (p.get("extract") or "").strip()
        if len(extract) < 80:
            continue
        title = p.get("title", "")
        page_id = p.get("pageid")
        fullurl = p.get("fullurl", f"https://en.wikipedia.org/wiki/{title.replace(' ', '_')}")
        cats = [c["title"].replace("Category:", "") for c in p.get("categories", [])]
        out.append({
            "page_id": page_id,
            "title": title,
            "extract": extract,
            "wiki_url": fullurl,
            "categories": ",".join(cats[:5]),
        })
    return out


def fetch_links(page_id: int, limit: int = 10) -> list[int]:
    data = _wiki_get({
        "action": "query",
        "pageids": page_id,
        "prop": "links",
        "plnamespace": 0,
        "pllimit": 50,
    })
    pages = data.get("query", {}).get("pages", {})
    if not pages:
        return []
    links = list(pages.values())[0].get("links", [])
    # Get pageids for links (titles only in first response)
    if not links:
        return []
    titles = [l["title"] for l in links[:limit * 2]]
    data2 = _wiki_get({
        "action": "query",
        "titles": "|".join(titles[:20]),
        "prop": "pageid",
    })
    page_ids = []
    for p in data2.get("query", {}).get("pages", {}).values():
        if "pageid" in p and "missing" not in p:
            page_ids.append(p["pageid"])
    return page_ids[:limit]


def ensure_snippet(conn, item: dict, source_page_id: int | None = None) -> int | None:
    cur = conn.execute(
        "SELECT id FROM snippets WHERE page_id = ?",
        (item["page_id"],),
    )
    row = cur.fetchone()
    if row:
        return row["id"]
    conn.execute(
        """INSERT INTO snippets (page_id, title, extract, wiki_url, categories, source_page_id)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            item["page_id"],
            item["title"],
            item["extract"],
            item["wiki_url"],
            item.get("categories", ""),
            source_page_id,
        ),
    )
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def get_session_id():
    sid = flask.request.cookies.get("maxlearn_session")
    if sid:
        return sid
    return str(uuid.uuid4())


def get_liked_categories(conn, session_id: str) -> set[str]:
    rows = conn.execute("""
        SELECT s.categories FROM likes l
        JOIN snippets s ON s.id = l.snippet_id
        WHERE l.session_id = ? AND s.categories != ''
    """, (session_id,)).fetchall()
    out = set()
    for r in rows:
        out.update(c.strip() for c in (r["categories"] or "").split(",") if c.strip())
    return out


def get_seen_snippet_ids(conn, session_id: str) -> set[int]:
    liked = set(
        r[0] for r in conn.execute(
            "SELECT snippet_id FROM likes WHERE session_id = ?", (session_id,)
        ).fetchall()
    )
    skipped = set(
        r[0] for r in conn.execute(
            "SELECT snippet_id FROM skips WHERE session_id = ?", (session_id,)
        ).fetchall()
    )
    return liked | skipped


def get_liked_snippet_ids(conn, session_id: str) -> set[int]:
    return set(
        r[0] for r in conn.execute(
            "SELECT snippet_id FROM likes WHERE session_id = ?", (session_id,)
        ).fetchall()
    )


def get_neighbour_snippet_ids(conn, liked_ids: set[int]) -> set[int]:
    if not liked_ids:
        return set()
    placeholders = ",".join("?" * len(liked_ids))
    rows = conn.execute(
        f"SELECT id FROM snippets WHERE source_page_id IN (SELECT page_id FROM snippets WHERE id IN ({placeholders}))",
        tuple(liked_ids),
    ).fetchall()
    return set(r[0] for r in rows)


@app.route("/")
def index():
    resp = flask.make_response(flask.render_template("index.html"))
    if not flask.request.cookies.get("maxlearn_session"):
        resp.set_cookie("maxlearn_session", get_session_id(), max_age=60 * 60 * 24 * 365)
    return resp


@app.route("/api/next", methods=["GET"])
def api_next():
    init_db()
    session_id = get_session_id()
    with get_db() as conn:
        seen = get_seen_snippet_ids(conn, session_id)
        liked_ids = get_liked_snippet_ids(conn, session_id)
        liked_cats = get_liked_categories(conn, session_id)
        neighbour_ids = get_neighbour_snippet_ids(conn, liked_ids)

        # Prefer: neighbours of liked (unseen), then by category overlap, then random
        if seen:
            exclude = " AND s.id NOT IN (" + ",".join("?" * len(seen)) + ")"
            params = list(seen)
        else:
            exclude = ""
            params = []

        # Candidates: all snippets user can see (seed + neighbours of liked)
        pool_ids = list(neighbour_ids) if neighbour_ids else []
        if not pool_ids:
            cur = conn.execute(
                "SELECT id FROM snippets WHERE source_page_id IS NULL" + exclude,
                params,
            )
        else:
            placeholders = ",".join("?" * len(pool_ids))
            cur = conn.execute(
                f"""SELECT id FROM snippets s
                    WHERE (s.source_page_id IS NULL OR s.id IN ({placeholders}))
                    """ + exclude,
                list(pool_ids) + params,
            )
        candidates = [r[0] for r in cur.fetchall()]

        if not candidates:
            return flask.jsonify({"snippet": None, "message": "No more snippets. Like some to grow your feed!"})

        # Score: same-category boost
        def score(sid):
            row = conn.execute(
                "SELECT categories FROM snippets WHERE id = ?", (sid,)
            ).fetchone()
            if not row or not liked_cats:
                return 0
            cats = set(c.strip() for c in (row["categories"] or "").split(",") if c.strip())
            return len(cats & liked_cats)

        candidates.sort(key=lambda sid: (-score(sid), random.random()))
        pick = candidates[0]
        row = conn.execute(
            "SELECT id, title, extract, wiki_url FROM snippets WHERE id = ?",
            (pick,),
        ).fetchone()
        snippet = {
            "id": row["id"],
            "title": row["title"],
            "extract": row["extract"],
            "wiki_url": row["wiki_url"],
        }
    return flask.jsonify({"snippet": snippet})


@app.route("/api/like", methods=["POST"])
def api_like():
    init_db()
    data = flask.request.get_json() or {}
    snippet_id = data.get("snippet_id")
    if not snippet_id:
        return flask.jsonify({"error": "snippet_id required"}), 400
    session_id = get_session_id()
    with get_db() as conn:
        row = conn.execute(
            "SELECT id, page_id FROM snippets WHERE id = ?", (snippet_id,)
        ).fetchone()
        if not row:
            return flask.jsonify({"error": "snippet not found"}), 404
        conn.execute(
            "INSERT OR IGNORE INTO likes (session_id, snippet_id) VALUES (?, ?)",
            (session_id, snippet_id),
        )
        page_id = row["page_id"]
        # Fetch up to 10 neighbour articles and add to DB
        try:
            neighbour_ids = fetch_links(page_id, limit=10)
            for nid in neighbour_ids:
                time.sleep(0.15)
                try:
                    items = fetch_extract_and_categories([nid])
                    for item in items:
                        ensure_snippet(conn, item, source_page_id=page_id)
                except Exception:
                    continue
        except Exception:
            pass
    resp = flask.jsonify({"ok": True})
    if not flask.request.cookies.get("maxlearn_session"):
        resp.set_cookie("maxlearn_session", session_id, max_age=60 * 60 * 24 * 365)
    return resp


@app.route("/api/skip", methods=["POST"])
def api_skip():
    init_db()
    data = flask.request.get_json() or {}
    snippet_id = data.get("snippet_id")
    if not snippet_id:
        return flask.jsonify({"error": "snippet_id required"}), 400
    session_id = get_session_id()
    with get_db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO skips (session_id, snippet_id) VALUES (?, ?)",
            (session_id, snippet_id),
        )
    resp = flask.jsonify({"ok": True})
    if not flask.request.cookies.get("maxlearn_session"):
        resp.set_cookie("maxlearn_session", session_id, max_age=60 * 60 * 24 * 365)
    return resp


@app.route("/api/seed-status", methods=["GET"])
def api_seed_status():
    init_db()
    with get_db() as conn:
        total = conn.execute("SELECT COUNT(*) FROM snippets").fetchone()[0]
        seed_count = conn.execute(
            "SELECT COUNT(*) FROM snippets WHERE source_page_id IS NULL"
        ).fetchone()[0]
    return flask.jsonify({
        "total_snippets": total,
        "seed_snippets": seed_count,
        "ready": seed_count >= 10000,
    })


@app.before_request
def ensure_db():
    init_db()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
