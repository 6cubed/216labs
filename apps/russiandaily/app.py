# Russian Daily — 10 topical headlines per day, one highlighted word + translations
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
from markupsafe import Markup, escape

app = flask.Flask(__name__)

MOSCOW = ZoneInfo("Europe/Moscow")
DATA_DIR = os.environ.get("RUSSIANDAILY_DATA_DIR", "/app/data")
DB_PATH = Path(DATA_DIR) / "russiandaily.db"

# Curated fallback: news-style headlines (B1–B2). Used when no API key or LLM fails.
STATIC_HEADLINES: list[dict[str, str]] = [
    {
        "headline_ru": "В столице обсуждают повышение тарифов на городской транспорт.",
        "headline_en": "The capital is discussing a fare increase for city transport.",
        "highlight_ru": "повышение",
        "word_en": "increase, rise",
        "topic": "urban",
    },
    {
        "headline_ru": "Министр пообещал поддержку семьям с детьми дошкольного возраста.",
        "headline_en": "The minister promised support for families with preschool-age children.",
        "highlight_ru": "поддержку",
        "word_en": "support (acc.)",
        "topic": "politics",
    },
    {
        "headline_ru": "Синоптики предупреждают о похолодании на выходных.",
        "headline_en": "Forecasters warn of a cold snap on the weekend.",
        "highlight_ru": "похолодании",
        "word_en": "cold snap, cooling",
        "topic": "weather",
    },
    {
        "headline_ru": "Рубль укрепился к доллару после заявления регулятора.",
        "headline_en": "The ruble strengthened against the dollar after the regulator's statement.",
        "highlight_ru": "укрепился",
        "word_en": "strengthened (verb)",
        "topic": "economy",
    },
    {
        "headline_ru": "В регионе ввели ограничения на выезд в лес из-за пожароопасности.",
        "headline_en": "The region introduced restrictions on entering the forest due to fire risk.",
        "highlight_ru": "пожароопасности",
        "word_en": "fire hazard",
        "topic": "environment",
    },
    {
        "headline_ru": "Учёные представили новый метод ранней диагностики заболеваний.",
        "headline_en": "Scientists presented a new method for early diagnosis of diseases.",
        "highlight_ru": "диагностики",
        "word_en": "diagnosis (gen.)",
        "topic": "science",
    },
    {
        "headline_ru": "Фестиваль современного кино откроется в следующем месяце.",
        "headline_en": "The contemporary film festival will open next month.",
        "highlight_ru": "современного",
        "word_en": "contemporary, modern (gen.)",
        "topic": "culture",
    },
    {
        "headline_ru": "Министерство образования объявило о реформе школьных программ.",
        "headline_en": "The Ministry of Education announced a reform of school curricula.",
        "highlight_ru": "реформе",
        "word_en": "reform (prep.)",
        "topic": "education",
    },
    {
        "headline_ru": "Международная выставка технологий соберёт участников из двадцати стран.",
        "headline_en": "The international technology exhibition will bring together participants from twenty countries.",
        "highlight_ru": "участников",
        "word_en": "participants (gen. pl.)",
        "topic": "tech",
    },
    {
        "headline_ru": "Местные жители обеспокоены строительством новой трассы.",
        "headline_en": "Local residents are concerned about the construction of a new highway.",
        "highlight_ru": "обеспокоены",
        "word_en": "concerned, worried",
        "topic": "urban",
    },
    {
        "headline_ru": "Президент выступил с обращением к нации по вопросам безопасности.",
        "headline_en": "The president addressed the nation on security issues.",
        "highlight_ru": "обращением",
        "word_en": "address, appeal (instr.)",
        "topic": "politics",
    },
    {
        "headline_ru": "В аэропорту задержали рейсы из-за сильного тумана.",
        "headline_en": "Flights were delayed at the airport due to heavy fog.",
        "highlight_ru": "задержали",
        "word_en": "delayed (pl.)",
        "topic": "travel",
    },
    {
        "headline_ru": "Эксперты отмечают рост интереса к электромобилям.",
        "headline_en": "Experts note growing interest in electric vehicles.",
        "highlight_ru": "электромобилям",
        "word_en": "electric vehicles (dat.)",
        "topic": "tech",
    },
    {
        "headline_ru": "Мэр города пообещал благоустройство набережной к лету.",
        "headline_en": "The mayor promised to improve the embankment by summer.",
        "highlight_ru": "благоустройство",
        "word_en": "improvement, landscaping",
        "topic": "urban",
    },
    {
        "headline_ru": "Сборная готовится к решающему матчу чемпионата.",
        "headline_en": "The national team is preparing for the decisive championship match.",
        "highlight_ru": "решающему",
        "word_en": "decisive, crucial (dat.)",
        "topic": "sports",
    },
    {
        "headline_ru": "Цены на бензин снова изменились на крупных заправках.",
        "headline_en": "Gasoline prices have changed again at major filling stations.",
        "highlight_ru": "заправках",
        "word_en": "filling stations (prep.)",
        "topic": "economy",
    },
    {
        "headline_ru": "Врачи напоминают о важности вакцинации перед сезоном гриппа.",
        "headline_en": "Doctors remind people of the importance of vaccination before flu season.",
        "highlight_ru": "вакцинации",
        "word_en": "vaccination (gen.)",
        "topic": "health",
    },
    {
        "headline_ru": "Пожарные потушили крупный склад в промышленной зоне.",
        "headline_en": "Firefighters extinguished a large warehouse in the industrial zone.",
        "highlight_ru": "потушили",
        "word_en": "extinguished (verb)",
        "topic": "news",
    },
    {
        "headline_ru": "Студенты провели акцию в поддержку экологических инициатив.",
        "headline_en": "Students held a rally in support of environmental initiatives.",
        "highlight_ru": "инициатив",
        "word_en": "initiatives (gen.)",
        "topic": "environment",
    },
    {
        "headline_ru": "Центральный банк сохранил ключевую ставку без изменений.",
        "headline_en": "The central bank kept the key rate unchanged.",
        "highlight_ru": "ставку",
        "word_en": "rate (acc.)",
        "topic": "economy",
    },
    {
        "headline_ru": "В театре премьера новой постановки по классическому роману.",
        "headline_en": "The theatre premieres a new production based on a classic novel.",
        "highlight_ru": "постановки",
        "word_en": "production, staging (gen.)",
        "topic": "culture",
    },
    {
        "headline_ru": "Туристы жалуются на переполненные пляжи в разгар сезона.",
        "headline_en": "Tourists complain about overcrowded beaches in peak season.",
        "highlight_ru": "переполненные",
        "word_en": "overcrowded",
        "topic": "travel",
    },
    {
        "headline_ru": "Компания объявила о сокращении штата из-за оптимизации расходов.",
        "headline_en": "The company announced staff cuts due to cost optimization.",
        "highlight_ru": "сокращении",
        "word_en": "reduction, cut (prep.)",
        "topic": "economy",
    },
    {
        "headline_ru": "В регионе ввели чрезвычайное положение из-за наводнения.",
        "headline_en": "The region declared a state of emergency due to flooding.",
        "highlight_ru": "наводнения",
        "word_en": "flooding (gen.)",
        "topic": "weather",
    },
    {
        "headline_ru": "Разработчики выпустили обновление с исправлением уязвимостей.",
        "headline_en": "Developers released an update fixing vulnerabilities.",
        "highlight_ru": "уязвимостей",
        "word_en": "vulnerabilities (gen.)",
        "topic": "tech",
    },
    {
        "headline_ru": "Фермеры сообщают о хорошем урожае зерновых в этом году.",
        "headline_en": "Farmers report a good grain harvest this year.",
        "highlight_ru": "урожае",
        "word_en": "harvest (prep.)",
        "topic": "economy",
    },
    {
        "headline_ru": "Суд отложил рассмотрение дела до следующего заседания.",
        "headline_en": "The court postponed the hearing until the next session.",
        "highlight_ru": "рассмотрение",
        "word_en": "consideration, hearing (acc.)",
        "topic": "news",
    },
    {
        "headline_ru": "Волонтёры организовали сбор помощи для пострадавших от урагана.",
        "headline_en": "Volunteers organized a collection of aid for hurricane victims.",
        "highlight_ru": "пострадавших",
        "word_en": "victims, those affected (gen.)",
        "topic": "news",
    },
    {
        "headline_ru": "Учёные зафиксировали рекордную температуру в Арктике.",
        "headline_en": "Scientists recorded a record temperature in the Arctic.",
        "highlight_ru": "рекордную",
        "word_en": "record (acc. fem.)",
        "topic": "environment",
    },
    {
        "headline_ru": "Производитель отозвал партию продукции по соображениям безопасности.",
        "headline_en": "The manufacturer recalled a batch of products for safety reasons.",
        "highlight_ru": "отозвал",
        "word_en": "recalled, withdrew (verb)",
        "topic": "health",
    },
    {
        "headline_ru": "В метро открыли новую станцию на окраине города.",
        "headline_en": "A new metro station opened on the outskirts of the city.",
        "highlight_ru": "окраине",
        "word_en": "outskirts, edge (prep.)",
        "topic": "urban",
    },
    {
        "headline_ru": "Конкурс молодых режиссёров получил неожиданно высокий отклик.",
        "headline_en": "The young directors' competition received an unexpectedly strong response.",
        "highlight_ru": "отклик",
        "word_en": "response, feedback",
        "topic": "culture",
    },
    {
        "headline_ru": "Министр пообещал ускорить выдачу разрешений на строительство.",
        "headline_en": "The minister promised to speed up issuing construction permits.",
        "highlight_ru": "разрешений",
        "word_en": "permits (gen.)",
        "topic": "politics",
    },
    {
        "headline_ru": "Соревнование по биатлону перенесли из-за погодных условий.",
        "headline_en": "The biathlon competition was postponed due to weather conditions.",
        "highlight_ru": "перенесли",
        "word_en": "postponed, moved (verb)",
        "topic": "sports",
    },
    {
        "headline_ru": "Жители района выступают против сноса исторического здания.",
        "headline_en": "District residents oppose the demolition of a historic building.",
        "highlight_ru": "сноса",
        "word_en": "demolition (gen.)",
        "topic": "urban",
    },
    {
        "headline_ru": "Космическое агентство объявило набор добровольцев для эксперимента.",
        "headline_en": "The space agency announced recruitment of volunteers for an experiment.",
        "highlight_ru": "добровольцев",
        "word_en": "volunteers (gen.)",
        "topic": "science",
    },
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
            CREATE TABLE IF NOT EXISTS daily_headlines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                date TEXT NOT NULL,
                slot INTEGER NOT NULL CHECK (slot >= 0 AND slot < 10),
                headline_ru TEXT NOT NULL,
                headline_en TEXT NOT NULL,
                highlight_ru TEXT NOT NULL,
                word_en TEXT NOT NULL,
                topic TEXT NOT NULL DEFAULT '',
                UNIQUE (date, slot)
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS votes (
                word_id INTEGER PRIMARY KEY REFERENCES daily_headlines(id) ON DELETE CASCADE,
                vote INTEGER NOT NULL CHECK (vote IN (1, -1)),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_daily_headlines_date ON daily_headlines(date)"
        )


def moscow_date_str() -> str:
    return datetime.now(MOSCOW).date().isoformat()


def norm_key(s: str) -> str:
    return re.sub(r"\s+", " ", (s or "").strip()).lower()


def recent_headline_keys(conn: sqlite3.Connection, days: int = 120) -> set[str]:
    cutoff = (datetime.now(MOSCOW).date() - timedelta(days=days)).isoformat()
    rows = conn.execute(
        "SELECT headline_ru, highlight_ru FROM daily_headlines WHERE date >= ?",
        (cutoff,),
    ).fetchall()
    return {norm_key(r[0]) + "|" + norm_key(r[1]) for r in rows}


def topic_scores_from_votes(conn: sqlite3.Connection) -> dict[str, float]:
    rows = conn.execute(
        """
        SELECT dh.topic, SUM(v.vote) AS score
        FROM votes v
        JOIN daily_headlines dh ON dh.id = v.word_id
        WHERE dh.topic IS NOT NULL AND TRIM(dh.topic) != ''
        GROUP BY dh.topic
        """
    ).fetchall()
    return {r[0]: float(r[1]) for r in rows}


def topic_weight(topic: str, scores: dict[str, float]) -> float:
    s = scores.get(topic, 0.0)
    return max(0.08, 1.0 + 0.22 * s)


def validate_item(item: dict[str, str]) -> bool:
    hr = (item.get("headline_ru") or "").strip()
    he = (item.get("headline_en") or "").strip()
    hl = (item.get("highlight_ru") or "").strip()
    we = (item.get("word_en") or "").strip()
    if not (hr and he and hl and we):
        return False
    if hl not in hr:
        return False
    return True


def pick_static_batch(
    exclude: set[str],
    scores: dict[str, float],
    n: int = 10,
) -> list[dict[str, str]]:
    pool = [
        h.copy()
        for h in STATIC_HEADLINES
        if norm_key(h["headline_ru"]) + "|" + norm_key(h["highlight_ru"]) not in exclude
    ]
    if len(pool) < n:
        pool = [h.copy() for h in STATIC_HEADLINES]

    topics = list({h["topic"] for h in pool})
    out: list[dict[str, str]] = []
    used: set[str] = set()

    for _ in range(n * 5):
        if len(out) >= n:
            break
        weights = [topic_weight(t, scores) for t in topics]
        t = random.choices(topics, weights=weights, k=1)[0]
        candidates = [
            h
            for h in pool
            if h["topic"] == t
            and norm_key(h["headline_ru"]) + "|" + norm_key(h["highlight_ru"]) not in used
        ]
        if not candidates:
            candidates = [
                h
                for h in pool
                if norm_key(h["headline_ru"]) + "|" + norm_key(h["highlight_ru"]) not in used
            ]
        if not candidates:
            break
        choice = random.choice(candidates)
        key = norm_key(choice["headline_ru"]) + "|" + norm_key(choice["highlight_ru"])
        if key in used:
            continue
        used.add(key)
        out.append(choice)

    while len(out) < n and pool:
        h = random.choice(pool)
        k = norm_key(h["headline_ru"]) + "|" + norm_key(h["highlight_ru"])
        if k not in used:
            used.add(k)
            out.append(h.copy())
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
    items = data.get("headlines") or data.get("items") or data.get("words")
    if not isinstance(items, list):
        return []
    out = []
    for w in items:
        if not isinstance(w, dict):
            continue
        item = {
            "headline_ru": str(w.get("headline_ru", "")).strip(),
            "headline_en": str(w.get("headline_en", "")).strip(),
            "highlight_ru": str(w.get("highlight_ru", "")).strip(),
            "word_en": str(w.get("word_en", "")).strip(),
            "topic": str(w.get("topic", "general")).strip() or "general",
        }
        item["topic"] = item["topic"][:80]
        if validate_item(item):
            out.append(item)
    return out


def generate_batch_llm(
    favor: list[str],
    avoid: list[str],
    exclude: set[str],
) -> list[dict[str, str]] | None:
    api_key = (os.environ.get("RUSSIANDAILY_OPENAI_API_KEY") or "").strip()
    if not api_key:
        return None
    exclude_sample = ", ".join(sorted(exclude)[:80]) if exclude else "(none yet)"
    favor_s = ", ".join(favor) if favor else "balanced mix of useful themes"
    avoid_s = ", ".join(avoid) if avoid else "(none specified)"

    prompt = f"""You help a Russian learner (single user). Return ONLY valid JSON, no markdown.
Shape: {{"headlines":[{{"headline_ru":"...","headline_en":"...","highlight_ru":"...","word_en":"...","topic":"short tag"}}]}}
Exactly 10 items. Russian headlines must sound like real news (8–18 words). Level B1–B2.
headline_ru: one Russian headline sentence.
headline_en: natural English translation of the full headline (not a word list).
highlight_ru: EXACT substring copied from headline_ru (one word or a short phrase) — the teaching focus.
word_en: concise English gloss of that highlighted Russian (e.g. part of speech, case if helpful).
Themes to lean toward if natural: {favor_s}
Themes to de-emphasize or avoid: {avoid_s}
Do not reuse these Russian headlines or highlight pairs (case-insensitive): {exclude_sample}
"""

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        r = client.chat.completions.create(
            model="gpt-4o-mini",
            temperature=0.85,
            max_tokens=2400,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": prompt}],
        )
        text = (r.choices[0].message.content or "").strip()
        items = parse_llm_json(text)
        seen: set[str] = set()
        deduped = []
        for h in items:
            k = norm_key(h["headline_ru"]) + "|" + norm_key(h["highlight_ru"])
            if k in seen or k in exclude:
                continue
            seen.add(k)
            deduped.append(h)
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


def ensure_today_headlines(conn: sqlite3.Connection) -> None:
    today = moscow_date_str()
    n = conn.execute(
        "SELECT COUNT(*) FROM daily_headlines WHERE date = ?", (today,)
    ).fetchone()[0]
    if n >= 10:
        return

    conn.execute("DELETE FROM daily_headlines WHERE date = ?", (today,))

    exclude = recent_headline_keys(conn)
    scores = topic_scores_from_votes(conn)
    favor, avoid = favor_avoid_lists(scores)

    batch = generate_batch_llm(favor, avoid, exclude)
    if not batch or len(batch) < 10:
        batch = pick_static_batch(exclude, scores, 10)
    if len(batch) < 10:
        batch = [h.copy() for h in STATIC_HEADLINES[:10]]

    for slot, h in enumerate(batch[:10]):
        conn.execute(
            """
            INSERT INTO daily_headlines
            (date, slot, headline_ru, headline_en, highlight_ru, word_en, topic)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                today,
                slot,
                h["headline_ru"],
                h["headline_en"],
                h["highlight_ru"],
                h["word_en"],
                h.get("topic", ""),
            ),
        )
    conn.commit()


def headline_html(headline_ru: str, highlight_ru: str) -> Markup:
    needle = (highlight_ru or "").strip()
    h = headline_ru or ""
    if not needle or needle not in h:
        return Markup(f'<span class="headline-text">{escape(h)}</span>')
    i = h.find(needle)
    before = escape(h[:i])
    mid = escape(needle)
    after = escape(h[i + len(needle) :])
    return Markup(
        f'<span class="headline-text">{before}<mark class="hl">{mid}</mark>{after}</span>'
    )


@app.route("/")
def index():
    with get_db() as conn:
        ensure_today_headlines(conn)
        today = moscow_date_str()
        rows = conn.execute(
            """
            SELECT dh.id, dh.headline_ru, dh.headline_en, dh.highlight_ru, dh.word_en,
                   v.vote AS user_vote
            FROM daily_headlines dh
            LEFT JOIN votes v ON v.word_id = dh.id
            WHERE dh.date = ?
            ORDER BY dh.slot
            """,
            (today,),
        ).fetchall()

    items = []
    for r in rows:
        d = dict(r)
        d["headline_html"] = headline_html(d["headline_ru"], d["highlight_ru"])
        items.append(d)

    return flask.render_template(
        "index.html",
        date_label=today,
        items=items,
        has_llm=bool((os.environ.get("RUSSIANDAILY_OPENAI_API_KEY") or "").strip()),
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
            "SELECT id FROM daily_headlines WHERE id = ?", (word_id,)
        ).fetchone()
        if not row:
            return flask.jsonify({"ok": False, "error": "unknown headline"}), 404
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
