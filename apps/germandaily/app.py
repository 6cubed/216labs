# German Daily — 10 words per day, votes steer topic mix for the next batch
from __future__ import annotations

import json
import os
import random
import re
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
try:
    from zoneinfo import ZoneInfo
except ImportError:  # Python < 3.9
    from backports.zoneinfo import ZoneInfo

import flask

app = flask.Flask(__name__)

BERLIN = ZoneInfo("Europe/Berlin")
DATA_DIR = os.environ.get("GERMANDAILY_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "germandaily.db"

# Curated fallback pool (A2–B1). Used when no API key or LLM fails.
STATIC_WORDS: list[dict[str, str]] = [
    {"german": "die Geduld", "english": "patience", "example_de": "Geduld ist manchmal die schwierigste Tugend.", "example_en": "Patience is sometimes the hardest virtue.", "topic": "feelings"},
    {"german": "enttäuscht", "english": "disappointed", "example_de": "Ich war von dem Film leider enttäuscht.", "example_en": "I was disappointed by the film, unfortunately.", "topic": "feelings"},
    {"german": "der Vorschlag", "english": "suggestion, proposal", "example_de": "Das ist ein vernünftiger Vorschlag.", "example_en": "That is a reasonable suggestion.", "topic": "work"},
    {"german": "die Frist", "english": "deadline", "example_de": "Wir müssen die Frist unbedingt einhalten.", "example_en": "We absolutely have to meet the deadline.", "topic": "work"},
    {"german": "die Verbindung", "english": "connection (train, call, link)", "example_de": "Die Verbindung nach München fällt heute aus.", "example_en": "The connection to Munich is cancelled today.", "topic": "travel"},
    {"german": "umsteigen", "english": "to change (trains)", "example_de": "In Frankfurt müssen wir umsteigen.", "example_en": "We have to change trains in Frankfurt.", "topic": "travel"},
    {"german": "die Speisekarte", "english": "menu (restaurant)", "example_de": "Können wir bitte die Speisekarte sehen?", "example_en": "Could we see the menu, please?", "topic": "food"},
    {"german": "satt", "english": "full (after eating)", "example_de": "Ich bin schon satt, danke.", "example_en": "I'm already full, thanks.", "topic": "food"},
    {"german": "die Miete", "english": "rent", "example_de": "Die Miete steigt jedes Jahr ein wenig.", "example_en": "The rent goes up a little every year.", "topic": "housing"},
    {"german": "der Nachbar", "english": "neighbor (male)", "example_de": "Unser Nachbar hilft uns oft im Garten.", "example_en": "Our neighbor often helps us in the garden.", "topic": "housing"},
    {"german": "die Aussicht", "english": "view, outlook", "example_de": "Vom Balkon haben wir eine tolle Aussicht.", "example_en": "From the balcony we have a great view.", "topic": "nature"},
    {"german": "spazieren gehen", "english": "to go for a walk", "example_de": "Nach dem Essen gehen wir kurz spazieren.", "example_en": "After dinner we go for a short walk.", "topic": "nature"},
    {"german": "die Gewohnheit", "english": "habit", "example_de": "Es ist eine schlechte Gewohnheit, so spät aufzustehen.", "example_en": "It's a bad habit to get up so late.", "topic": "everyday"},
    {"german": "plötzlich", "english": "suddenly", "example_de": "Plötzlich begann es stark zu regnen.", "example_en": "Suddenly it started raining heavily.", "topic": "everyday"},
    {"german": "die Leidenschaft", "english": "passion", "example_de": "Er liest mit großer Leidenschaft.", "example_en": "He reads with great passion.", "topic": "culture"},
    {"german": "das Theaterstück", "english": "play (theatre)", "example_de": "Das Theaterstück hat uns alle beeindruckt.", "example_en": "The play impressed all of us.", "topic": "culture"},
    {"german": "sich erinnern", "english": "to remember", "example_de": "Ich erinnere mich noch gut an den Tag.", "example_en": "I still remember that day well.", "topic": "verbs"},
    {"german": "vergleichen", "english": "to compare", "example_de": "Man sollte Äpfel nicht mit Birnen vergleichen.", "example_en": "You shouldn't compare apples and oranges.", "topic": "verbs"},
    {"german": "die Verspätung", "english": "delay", "example_de": "Wegen eines Unfalls gab es eine Verspätung.", "example_en": "There was a delay because of an accident.", "topic": "travel"},
    {"german": "die Reservierung", "english": "reservation", "example_de": "Haben Sie eine Reservierung auf den Namen Koch?", "example_en": "Do you have a reservation under the name Koch?", "topic": "food"},
    {"german": "scharf", "english": "spicy; sharp", "example_de": "Diese Soße ist mir zu scharf.", "example_en": "This sauce is too spicy for me.", "topic": "food"},
    {"german": "die Bewerbung", "english": "application (job)", "example_de": "Ich habe meine Bewerbung gestern abgeschickt.", "example_en": "I sent off my application yesterday.", "topic": "work"},
    {"german": "die Kollegin", "english": "female colleague", "example_de": "Meine Kollegin hat mir das Projekt erklärt.", "example_en": "My colleague explained the project to me.", "topic": "work"},
    {"german": "die Unsicherheit", "english": "uncertainty, insecurity", "example_de": "Vor der Prüfung spürte ich große Unsicherheit.", "example_en": "Before the exam I felt a lot of uncertainty.", "topic": "feelings"},
    {"german": "der Vorteil", "english": "advantage", "example_de": "Ein großer Vorteil ist die zentrale Lage.", "example_en": "A big advantage is the central location.", "topic": "everyday"},
    {"german": "die Heizung", "english": "heating", "example_de": "Die Heizung in der Wohnung ist kaputt.", "example_en": "The heating in the apartment is broken.", "topic": "housing"},
    {"german": "der Umweg", "english": "detour", "example_de": "Wir mussten einen weiten Umweg fahren.", "example_en": "We had to take a long detour.", "topic": "travel"},
    {"german": "das Gericht", "english": "dish; court", "example_de": "Das Gericht ist frisch und regional.", "example_en": "The dish is fresh and regional.", "topic": "food"},
    {"german": "die Landschaft", "english": "landscape, countryside", "example_de": "Die Landschaft hier ist wunderschön.", "example_en": "The landscape here is beautiful.", "topic": "nature"},
    {"german": "die Verabredung", "english": "appointment, date", "example_de": "Ich habe heute eine Verabredung um acht.", "example_en": "I have an appointment at eight today.", "topic": "everyday"},
    {"german": "beeindruckend", "english": "impressive", "example_de": "Die Ausstellung war wirklich beeindruckend.", "example_en": "The exhibition was really impressive.", "topic": "culture"},
    {"german": "zustimmen", "english": "to agree", "example_de": "Ich kann dem Plan nur zustimmen.", "example_en": "I can only agree with the plan.", "topic": "verbs"},
    {"german": "die Erwartung", "english": "expectation", "example_de": "Die Erwartungen waren sehr hoch.", "example_en": "The expectations were very high.", "topic": "feelings"},
    {"german": "die Steuer", "english": "tax", "example_de": "Auf Bücher fällt in Deutschland eine reduzierte Steuer.", "example_en": "In Germany books are subject to a reduced tax.", "topic": "work"},
    {"german": "die Unterkunft", "english": "accommodation", "example_de": "Wir haben eine günstige Unterkunft gefunden.", "example_en": "We found affordable accommodation.", "topic": "travel"},
    {"german": "der Bahnhof", "english": "train station", "example_de": "Am Bahnhof treffen wir uns um zehn.", "example_en": "We'll meet at the station at ten.", "topic": "travel"},
    {"german": "die Treppe", "english": "stairs", "example_de": "Die Wohnung liegt im dritten Stock ohne Aufzug.", "example_en": "The apartment is on the third floor without a lift.", "topic": "housing"},
    {"german": "das Vertrauen", "english": "trust", "example_de": "Vertrauen muss man sich verdienen.", "example_en": "You have to earn trust.", "topic": "feelings"},
    {"german": "die Jahreszeit", "english": "season (of the year)", "example_de": "Der Herbst ist meine liebste Jahreszeit.", "example_en": "Autumn is my favorite season.", "topic": "nature"},
    {"german": "die Eile", "english": "hurry", "example_de": "Es besteht keine Eile, wir haben Zeit.", "example_en": "There's no hurry; we have time.", "topic": "everyday"},
    {"german": "die Zutat", "english": "ingredient", "example_de": "Alle Zutaten sollten bei Zimmertemperatur sein.", "example_en": "All ingredients should be at room temperature.", "topic": "food"},
    {"german": "die Aufführung", "english": "performance (show)", "example_de": "Die Aufführung dauerte fast drei Stunden.", "example_en": "The performance lasted almost three hours.", "topic": "culture"},
    {"german": "sich freuen auf", "english": "to look forward to", "example_de": "Ich freue mich schon auf das Wochenende.", "example_en": "I'm already looking forward to the weekend.", "topic": "verbs"},
    {"german": "die Stimmung", "english": "mood; atmosphere", "example_de": "Die Stimmung auf der Party war ausgelassen.", "example_en": "The mood at the party was exuberant.", "topic": "feelings"},
    {"german": "die Überstunde", "english": "overtime hour", "example_de": "Letzte Woche musste ich viele Überstunden machen.", "example_en": "Last week I had to work a lot of overtime.", "topic": "work"},
]


def get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS daily_words (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 10),
                german TEXT NOT NULL,
                english TEXT NOT NULL,
                example_de TEXT NOT NULL,
                example_en TEXT NOT NULL,
                topic TEXT NOT NULL DEFAULT '',
                UNIQUE (date, slot)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                word_id INTEGER PRIMARY KEY REFERENCES daily_words(id) ON DELETE CASCADE,
                vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_daily_words_date ON daily_words(date)")


def berlin_date_str() -> str:
    return datetime.now(BERLIN).date().isoformat()


def norm_german(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def recent_german_lemmas(conn: sqlite3.Connection, days: int = 120) -> set[str]:
    cutoff = (datetime.now(BERLIN).date() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT DISTINCT german FROM daily_words WHERE date >= ?",
        (cutoff,),
    ).fetchall()
    return {norm_german(r[0]) for r in rows}


def topic_scores_from_votes(conn: sqlite3.Connection) -> dict[str, float]:
    rows = conn.execute(
        """
        SELECT dw.topic, SUM(v.vote) AS score
        FROM votes v
        JOIN daily_words dw ON dw.id = v.word_id
        WHERE dw.topic IS NOT NULL AND TRIM(dw.topic) != ''
        GROUP BY dw.topic
        """
    ).fetchall()
    return {r[0]: float(r[1]) for r in rows}


def topic_weight(topic: str, scores: dict[str, float]) -> float:
    s = scores.get(topic, 0.0)
    # Up-voted topics get heavier; down-voted sink but stay selectable
    return max(0.08, 1.0 + 0.22 * s)


def pick_static_batch(
    exclude: set[str],
    scores: dict[str, float],
    n: int = 10,
) -> list[dict[str, str]]:
    pool = [w.copy() for w in STATIC_WORDS if norm_german(w["german"]) not in exclude]
    if len(pool) < n:
        pool = [w.copy() for w in STATIC_WORDS]

    topics = list({w["topic"] for w in pool})
    out: list[dict[str, str]] = []
    used: set[str] = set()

    for _ in range(n * 5):
        if len(out) >= n:
            break
        weights = [topic_weight(t, scores) for t in topics]
        t = random.choices(topics, weights=weights, k=1)[0]
        candidates = [
            w for w in pool
            if w["topic"] == t and norm_german(w["german"]) not in used
        ]
        if not candidates:
            candidates = [w for w in pool if norm_german(w["german"]) not in used]
        if not candidates:
            break
        choice = random.choice(candidates)
        key = norm_german(choice["german"])
        if key in used:
            continue
        used.add(key)
        out.append(choice)

    while len(out) < n and pool:
        w = random.choice(pool)
        k = norm_german(w["german"])
        if k not in used:
            used.add(k)
            out.append(w.copy())
    return out[:n]


def parse_llm_json(text: str) -> list[dict[str, str]]:
    text = (text or "").strip()
    if not text:
        return []
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if not m:
            return []
        data = json.loads(m.group())
    words = data.get("words") or data.get("items")
    if not isinstance(words, list):
        return []
    out = []
    for w in words:
        if not isinstance(w, dict):
            continue
        g = str(w.get("german", "")).strip()
        e = str(w.get("english", "")).strip()
        ed = str(w.get("example_de", "")).strip()
        ee = str(w.get("example_en", "")).strip()
        topic = str(w.get("topic", "general")).strip() or "general"
        if g and e and ed and ee:
            out.append({
                "german": g,
                "english": e,
                "example_de": ed,
                "example_en": ee,
                "topic": topic[:80],
            })
    return out


def generate_batch_llm(
    favor: list[str],
    avoid: list[str],
    exclude: set[str],
) -> list[dict[str, str]] | None:
    api_key = (os.environ.get("GERMANDAILY_OPENAI_API_KEY") or "").strip()
    if not api_key:
        return None
    exclude_sample = ", ".join(sorted(exclude)[:80]) if exclude else "(none yet)"
    favor_s = ", ".join(favor) if favor else "balanced mix of useful themes"
    avoid_s = ", ".join(avoid) if avoid else "(none specified)"

    prompt = f"""You help a German learner (single user). Return ONLY valid JSON, no markdown.
Shape: {{"words":[{{"german":"...","english":"...","example_de":"...","example_en":"...","topic":"short tag"}}]}}
Exactly 10 items. Level A2–B1. German headword can include article for nouns (e.g. "die Zeit").
example_de: one natural German sentence (6–20 words) using the word.
example_en: English translation of that sentence (not a gloss of the headword only).
Themes to lean toward if natural: {favor_s}
Themes to de-emphasize or avoid: {avoid_s}
Do not reuse these German expressions (case-insensitive match): {exclude_sample}
"""

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.85,
            max_tokens=2200,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        text = (r.choices[0].message.content or "").strip()
        words = parse_llm_json(text)
        seen: set[str] = set()
        deduped = []
        for w in words:
            k = norm_german(w["german"])
            if k in seen or k in exclude:
                continue
            seen.add(k)
            deduped.append(w)
            if len(deduped) >= 10:
                break
        if len(deduped) < 10:
            return None
        return deduped[:10]
    except Exception:
        return None


def favor_avoid_lists(scores: dict[str, float]) -> tuple[list[str], list[str]]:
    if not scores:
        return [], []
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    favor = [t for t, s in ranked if s > 0][:6]
    avoid = [t for t, s in ranked if s < 0][:6]
    return favor, avoid


def ensure_today_words(conn: sqlite3.Connection) -> None:
    today = berlin_date_str()
    n = conn.execute(
        "SELECT COUNT(*) FROM daily_words WHERE date = ?", (today,)
    ).fetchone()[0]
    if n >= 10:
        return

    conn.execute("DELETE FROM daily_words WHERE date = ?", (today,))

    exclude = recent_german_lemmas(conn)
    scores = topic_scores_from_votes(conn)
    favor, avoid = favor_avoid_lists(scores)

    batch = generate_batch_llm(favor, avoid, exclude)
    if not batch or len(batch) < 10:
        batch = pick_static_batch(exclude, scores, 10)
    if len(batch) < 10:
        # Last resort: repeat from static with replacement
        batch = [w.copy() for w in STATIC_WORDS[:10]]

    for slot, w in enumerate(batch[:10]):
        conn.execute(
            """
            INSERT INTO daily_words
            (date, slot, german, english, example_de, example_en, topic)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                today,
                slot,
                w["german"],
                w["english"],
                w["example_de"],
                w["example_en"],
                w.get("topic", ""),
            ),
        )
    conn.commit()


@app.route("/")
def index():
    with get_db() as conn:
        ensure_today_words(conn)
        today = berlin_date_str()
        rows = conn.execute(
            """
            SELECT dw.id, dw.german, dw.english, dw.example_de, dw.example_en,
                   v.vote AS user_vote
            FROM daily_words dw
            LEFT JOIN votes v ON v.word_id = dw.id
            WHERE dw.date = ?
            ORDER BY dw.slot
            """,
            (today,),
        ).fetchall()

    return flask.render_template(
        "index.html",
        date_label=today,
        words=[dict(r) for r in rows],
        has_llm=bool((os.environ.get("GERMANDAILY_OPENAI_API_KEY") or "").strip()),
    )


@app.route("/api/vote", methods=["POST"])
def api_vote():
    data = flask.request.get_json(silent=True) or {}
    try:
        word_id = int(data.get("word_id"))
        vote = int(data.get("vote"))
    except (TypeError, ValueError):
        return flask.jsonify({"ok": False, "error": "invalid payload"}), 400
    if vote not in (1, -1):
        return flask.jsonify({"ok": False, "error": "vote must be 1 or -1"}), 400

    with get_db() as conn:
        row = conn.execute(
            "SELECT id FROM daily_words WHERE id = ?", (word_id,)
        ).fetchone()
        if not row:
            return flask.jsonify({"ok": False, "error": "unknown word"}), 404
        conn.execute(
            """
            INSERT INTO votes (word_id, vote, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(word_id) DO UPDATE SET
                vote = excluded.vote,
                updated_at = excluded.updated_at
            """,
            (word_id, vote),
        )
        conn.commit()
    return flask.jsonify({"ok": True})


@app.route("/healthz")
def healthz():
    return "ok", 200, {"Content-Type": "text/plain"}


init_db()
