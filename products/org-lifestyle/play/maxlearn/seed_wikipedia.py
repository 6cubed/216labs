#!/usr/bin/env python3
"""Seed the MaxLearn DB with 10k Wikipedia snippets across a wide range of topics.
Run from repo root: python products/org-lifestyle/play/maxlearn/seed_wikipedia.py
Uses random articles + a few category-based batches for diversity."""
import os
import sys
import time
from pathlib import Path

# Add app to path so we can import from app
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sqlite3

import requests

WIKI_API = "https://en.wikipedia.org/w/api.php"
USER_AGENT = "MaxLearn/1.0 (https://maxlearn.6cubed.app; educational)"
TARGET = 10_000
BATCH_RANDOM = 500
BATCH_EXTRACT = 50
SLEEP_BETWEEN_REQUESTS = 0.2

DATA_DIR = os.environ.get("MAXLEARN_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "maxlearn.db"


def _wiki_get(params: dict) -> dict:
    params.setdefault("format", "json")
    params.setdefault("origin", "*")
    r = requests.get(
        WIKI_API,
        params=params,
        headers={"User-Agent": USER_AGENT},
        timeout=20,
    )
    r.raise_for_status()
    return r.json()


def fetch_random_page_ids(limit: int) -> list[int]:
    data = _wiki_get({
        "action": "query",
        "list": "random",
        "rnnamespace": 0,
        "rnlimit": min(limit, 500),
        "rnfilterredir": "nonredirects",
    })
    return [p["id"] for p in data.get("query", {}).get("random", [])]


def fetch_extract_batch(page_ids: list[int]) -> list[dict]:
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


def get_category_members(category: str, limit: int = 500) -> list[int]:
    data = _wiki_get({
        "action": "query",
        "list": "categorymembers",
        "cmtitle": f"Category:{category}",
        "cmtype": "page",
        "cmlimit": min(limit, 500),
        "cmnamespace": 0,
    })
    return [m["pageid"] for m in data.get("query", {}).get("categorymembers", [])]


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
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
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_snippets_page_id ON snippets(page_id)")
    conn.commit()

    cur_count = conn.execute("SELECT COUNT(*) FROM snippets WHERE source_page_id IS NULL").fetchone()[0]
    if cur_count >= TARGET:
        print(f"Already have {cur_count} seed snippets (target {TARGET}). Done.")
        return

    # Mix: mostly random, plus some category-based for diversity
    categories = [
        "History", "Science", "Geography", "Arts", "Philosophy",
        "Mathematics", "Technology", "Biology", "Music", "Literature",
    ]
    all_page_ids = set()
    for cat in categories:
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        try:
            ids = get_category_members(cat, limit=200)
            all_page_ids.update(ids)
        except Exception as e:
            print(f"Category {cat}: {e}")
    needed = TARGET - cur_count
    remaining = max(0, needed - len(all_page_ids))
    if remaining > 0:
        for _ in range(0, remaining, BATCH_RANDOM):
            time.sleep(SLEEP_BETWEEN_REQUESTS)
            try:
                ids = fetch_random_page_ids(BATCH_RANDOM)
                all_page_ids.update(ids)
                if len(all_page_ids) >= needed + 5000:
                    break
            except Exception as e:
                print(f"Random batch: {e}")

    page_ids = [pid for pid in all_page_ids]
    existing = set(
        r[0] for r in conn.execute(
            "SELECT page_id FROM snippets WHERE source_page_id IS NULL"
        ).fetchall()
    )
    page_ids = [pid for pid in page_ids if pid not in existing]
    random.shuffle(page_ids)
    inserted = 0
    for i in range(0, len(page_ids), BATCH_EXTRACT):
        batch = page_ids[i : i + BATCH_EXTRACT]
        time.sleep(SLEEP_BETWEEN_REQUESTS)
        try:
            items = fetch_extract_batch(batch)
            for item in items:
                try:
                    cur = conn.execute(
                        """INSERT OR IGNORE INTO snippets (page_id, title, extract, wiki_url, categories, source_page_id)
                           VALUES (?, ?, ?, ?, ?, NULL)""",
                        (
                            item["page_id"],
                            item["title"],
                            item["extract"],
                            item["wiki_url"],
                            item.get("categories", ""),
                        ),
                    )
                    if cur.rowcount:
                        inserted += 1
                        cur_count += 1
                        if cur_count >= TARGET:
                            break
                except Exception:
                    pass
        except Exception as e:
            print(f"Extract batch: {e}")
        if cur_count >= TARGET:
            break
        if (i // BATCH_EXTRACT) % 20 == 0 and i > 0:
            conn.commit()
            print(f"  ... {cur_count} seed snippets so far")
    conn.commit()
    final = conn.execute("SELECT COUNT(*) FROM snippets WHERE source_page_id IS NULL").fetchone()[0]
    print(f"Seed complete. Total seed snippets: {final} (target {TARGET}). Inserted this run: {inserted}")


if __name__ == "__main__":
    import random
    random.seed(42)
    main()
