"""
Premier League fixture and result scraper.

Uses the footballapi.pulselive.com endpoints that power the official
Premier League website (premierleague.com). No third-party API key needed.
"""

import logging
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger(__name__)

PL_API = "https://footballapi.pulselive.com/football"

HEADERS = {
    "Origin": "https://www.premierleague.com",
    "Referer": "https://www.premierleague.com/",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-GB,en;q=0.9",
}

TIMEOUT = 20


def get_current_season_id() -> int:
    url = f"{PL_API}/competitions/1/compseasons"
    resp = requests.get(
        url,
        headers=HEADERS,
        params={"page": 0, "pageSize": 1, "sort": "desc"},
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    data = resp.json()
    content = data.get("content", [])
    if not content:
        raise ValueError("No seasons returned from PL API")
    return content[0]["id"]


def _fetch_fixture_page(season_id: int, status: str, page: int = 0, page_size: int = 50) -> dict:
    url = f"{PL_API}/fixtures"
    resp = requests.get(
        url,
        headers=HEADERS,
        params={
            "compSeasons": season_id,
            "comps": 1,
            "page": page,
            "pageSize": page_size,
            "sort": "asc",
            "statuses": status,
        },
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def _parse_raw_fixture(raw: dict) -> dict | None:
    """Parse a raw fixture dict from the PL API into a normalised form."""
    try:
        teams = raw.get("teams", [])
        if len(teams) < 2:
            return None

        home = next((t for t in teams if t.get("teamRole") == "home"), teams[0])
        away = next((t for t in teams if t.get("teamRole") == "away"), teams[1])

        millis = raw.get("kickoff", {}).get("millis")
        if not millis:
            return None
        kickoff = datetime.fromtimestamp(millis / 1000, tz=timezone.utc)

        home_score = home.get("score")
        away_score = away.get("score")

        result = None
        if home_score is not None and away_score is not None:
            if home_score > away_score:
                result = "H"
            elif away_score > home_score:
                result = "A"
            else:
                result = "D"

        gw_data = raw.get("gameweek") or {}
        gw_number = gw_data.get("gameweek")

        return {
            "pl_id": str(raw["id"]),
            "home_team": home.get("team", {}).get("name", "Unknown"),
            "away_team": away.get("team", {}).get("name", "Unknown"),
            "kickoff": kickoff,
            "gameweek_number": gw_number,
            "status": raw.get("status", "U"),
            "result": result,
            "home_score": home_score,
            "away_score": away_score,
        }
    except Exception as exc:
        logger.warning("Failed to parse fixture %s: %s", raw.get("id"), exc)
        return None


def fetch_all_fixtures(season_id: int, status: str) -> list[dict]:
    """Fetch all pages for a given status."""
    page = 0
    results = []
    while True:
        data = _fetch_fixture_page(season_id, status, page=page)
        content = data.get("content", [])
        for raw in content:
            parsed = _parse_raw_fixture(raw)
            if parsed:
                results.append(parsed)
        page_info = data.get("pageInfo", {})
        num_pages = page_info.get("numPages", 1)
        if page >= num_pages - 1:
            break
        page += 1
    return results


def sync_fixtures(db) -> int:
    """
    Sync upcoming and live fixtures into the DB.
    Returns the number of fixtures upserted.
    """
    try:
        season_id = get_current_season_id()
    except Exception as exc:
        logger.error("Could not determine current season: %s", exc)
        return 0

    count = 0
    for status in ("U", "L"):
        try:
            fixtures = fetch_all_fixtures(season_id, status)
        except Exception as exc:
            logger.error("Error fetching %s fixtures: %s", status, exc)
            continue

        for f in fixtures:
            gw_number = f["gameweek_number"]
            if not gw_number:
                continue

            # Ensure gameweek row exists
            db.execute(
                "INSERT OR IGNORE INTO gameweeks (number) VALUES (?)", (gw_number,)
            )
            gw = db.execute(
                "SELECT id FROM gameweeks WHERE number = ?", (gw_number,)
            ).fetchone()
            if not gw:
                continue
            gw_id = gw["id"]

            # Upsert fixture
            existing = db.execute(
                "SELECT id FROM fixtures WHERE pl_id = ?", (f["pl_id"],)
            ).fetchone()

            kickoff_str = f["kickoff"].strftime("%Y-%m-%d %H:%M:%S")

            if existing:
                db.execute(
                    """UPDATE fixtures SET status = ?, home_team = ?, away_team = ?,
                       kickoff = ?, gameweek_id = ? WHERE pl_id = ?""",
                    (
                        f["status"],
                        f["home_team"],
                        f["away_team"],
                        kickoff_str,
                        gw_id,
                        f["pl_id"],
                    ),
                )
            else:
                db.execute(
                    """INSERT INTO fixtures (gameweek_id, pl_id, home_team, away_team, kickoff, status)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    (gw_id, f["pl_id"], f["home_team"], f["away_team"], kickoff_str, f["status"]),
                )
                count += 1

        db.commit()
        _update_gameweek_lock_times(db)

    logger.info("sync_fixtures: upserted %d new fixtures", count)
    return count


def sync_results(db) -> int:
    """
    Fetch completed fixtures, update scores/results.
    Returns the number of fixtures updated with results.
    """
    try:
        season_id = get_current_season_id()
    except Exception as exc:
        logger.error("Could not determine current season: %s", exc)
        return 0

    try:
        completed = fetch_all_fixtures(season_id, "C")
    except Exception as exc:
        logger.error("Error fetching completed fixtures: %s", exc)
        return 0

    updated = 0
    for f in completed:
        if f["result"] is None:
            continue
        existing = db.execute(
            "SELECT id, result FROM fixtures WHERE pl_id = ?", (f["pl_id"],)
        ).fetchone()
        if not existing:
            continue
        if existing["result"] == f["result"]:
            continue

        db.execute(
            """UPDATE fixtures SET status = 'C', result = ?, home_score = ?,
               away_score = ? WHERE pl_id = ?""",
            (f["result"], f["home_score"], f["away_score"], f["pl_id"]),
        )
        db.commit()

        # Award points immediately after updating the result
        from database import calculate_points_for_fixture
        calculate_points_for_fixture(existing["id"])

        updated += 1

    logger.info("sync_results: updated %d fixture results", updated)
    return updated


def _update_gameweek_lock_times(db):
    """
    Set each gameweek's lock_time to 2 hours before its earliest kickoff.
    """
    gameweeks = db.execute("SELECT id, number FROM gameweeks").fetchall()
    for gw in gameweeks:
        first = db.execute(
            "SELECT MIN(kickoff) AS earliest FROM fixtures WHERE gameweek_id = ?",
            (gw["id"],),
        ).fetchone()
        if not first or not first["earliest"]:
            continue

        try:
            earliest = datetime.fromisoformat(first["earliest"].replace("Z", "+00:00"))
            if earliest.tzinfo is None:
                earliest = earliest.replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        lock_time = earliest - timedelta(hours=2)
        db.execute(
            "UPDATE gameweeks SET lock_time = ?, synced_at = CURRENT_TIMESTAMP WHERE id = ?",
            (lock_time.strftime("%Y-%m-%d %H:%M:%S"), gw["id"]),
        )
    db.commit()


def get_active_gameweek_number(db) -> int | None:
    """
    Return the gameweek number that is 'active' — the next upcoming one,
    or the one currently in progress.
    """
    row = db.execute(
        """SELECT gw.number FROM gameweeks gw
           JOIN fixtures f ON f.gameweek_id = gw.id
           WHERE f.status IN ('U', 'L')
           ORDER BY f.kickoff ASC
           LIMIT 1"""
    ).fetchone()
    return row["number"] if row else None
