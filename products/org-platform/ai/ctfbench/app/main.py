from __future__ import annotations

import json
import os
import sqlite3
from typing import Any

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

from .challenges import CHALLENGES, get_challenge
from .db import connect, init_db, now_utc_s
from .flags import FlagConfigError, solver_fingerprint, verify_flag


BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "app", "templates"))

app = FastAPI(title="CTF Bench", version="0.1.0")

static_dir = os.path.join(BASE_DIR, "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


@app.on_event("startup")
def _startup():
    os.makedirs("/app/data", exist_ok=True)
    con = connect()
    init_db(con)
    con.close()


def _leaderboard(con) -> list[dict[str, Any]]:
    # "First solve wins": credit is based on earliest solve per challenge.
    rows = con.execute(
        """
        SELECT s.challenge_id, s.solver_name, s.solver_contact, s.solved_at_utc
        FROM solve s
        JOIN (
          SELECT challenge_id, MIN(solved_at_utc) AS t
          FROM solve
          GROUP BY challenge_id
        ) first
        ON first.challenge_id = s.challenge_id AND first.t = s.solved_at_utc
        ORDER BY s.solved_at_utc ASC;
        """
    ).fetchall()
    out: list[dict[str, Any]] = []
    for r in rows:
        out.append(
            {
                "challenge_id": r["challenge_id"],
                "solver_name": r["solver_name"],
                "solver_contact": r["solver_contact"],
                "solved_at_utc": int(r["solved_at_utc"]),
            }
        )
    return out


def _solves_by_challenge(con) -> dict[str, int]:
    rows = con.execute("SELECT challenge_id, COUNT(*) AS n FROM solve GROUP BY challenge_id").fetchall()
    return {str(r["challenge_id"]): int(r["n"]) for r in rows}


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    con = connect()
    try:
        lb = _leaderboard(con)
        counts = _solves_by_challenge(con)
    finally:
        con.close()
    return templates.TemplateResponse(
        "index.html",
        {
            "request": request,
            "challenges": CHALLENGES,
            "solve_counts": counts,
            "leaderboard": lb,
        },
    )


@app.get("/c/{challenge_id}", response_class=HTMLResponse)
def challenge_page(challenge_id: str, request: Request):
    c = get_challenge(challenge_id)
    if not c:
        raise HTTPException(status_code=404, detail="Challenge not found")

    con = connect()
    try:
        lb = _leaderboard(con)
        counts = _solves_by_challenge(con)
    finally:
        con.close()

    return templates.TemplateResponse(
        "challenge.html",
        {
            "request": request,
            "challenge": c,
            "solve_counts": counts,
            "leaderboard": lb,
        },
    )


@app.get("/api/challenges")
def api_challenges():
    return {
        "ok": True,
        "challenges": [
            {
                "id": c.id,
                "title": c.title,
                "category": c.category,
                "difficulty": c.difficulty,
                "points": c.points,
                "attachments": c.attachments,
            }
            for c in CHALLENGES
        ],
    }


@app.get("/api/leaderboard")
def api_leaderboard():
    con = connect()
    try:
        lb = _leaderboard(con)
    finally:
        con.close()
    return {"ok": True, "leaderboard": lb}


@app.post("/api/submit")
async def api_submit(request: Request):
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON") from None

    cid = str(payload.get("challenge_id") or "").strip()
    name = str(payload.get("name") or "").strip()
    contact = str(payload.get("contact") or "").strip() or None
    flag = str(payload.get("flag") or "").strip()

    if not cid or not get_challenge(cid):
        raise HTTPException(status_code=400, detail="Unknown challenge_id")
    if not name or len(name) > 80:
        raise HTTPException(status_code=400, detail="Name required (max 80 chars)")
    if not flag or len(flag) > 256:
        raise HTTPException(status_code=400, detail="Flag required (max 256 chars)")

    try:
        ok = verify_flag(cid, flag)
    except FlagConfigError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=503, detail=f"Flag digest JSON invalid: {e}") from e

    if not ok:
        return {"ok": True, "correct": False, "credited": False, "message": "Incorrect flag."}

    ip = request.client.host if request.client else ""
    ua = request.headers.get("user-agent", "")
    fp = solver_fingerprint(ip, ua, name)

    con = connect()
    try:
        init_db(con)
        t = now_utc_s()
        inserted_id: int | None = None
        try:
            cur = con.execute(
                "INSERT INTO solve(challenge_id, solver_name, solver_contact, solver_fingerprint, solved_at_utc) VALUES(?,?,?,?,?)",
                (cid, name, contact, fp, t),
            )
            con.commit()
            inserted_id = int(cur.lastrowid)
        except sqlite3.IntegrityError:
            con.rollback()
            inserted_id = None

        first = con.execute(
            "SELECT id FROM solve WHERE challenge_id=? ORDER BY solved_at_utc ASC, id ASC LIMIT 1",
            (cid,),
        ).fetchone()
        credited = bool(inserted_id is not None and first is not None and int(first["id"]) == inserted_id)
    finally:
        con.close()

    return {"ok": True, "correct": True, "credited": credited, "message": "Correct flag!"}

