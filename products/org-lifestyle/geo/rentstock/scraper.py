"""
Daft.ie rental listing ingest for rentstock markets.

Uses the public search API (gateway.daft.ie) that powers daft.ie search results.
"""

from __future__ import annotations

import logging
import math
import re
import time
from datetime import datetime, timezone

import requests

from criteria import MARKETS, MarketCriteria
from database import get_db, init_db

logger = logging.getLogger(__name__)

DAFT_LISTINGS_URL = "https://gateway.daft.ie/old/v1/listings"
DAFT_DETAIL_URL = "https://gateway.daft.ie/old/v1/listing/{daft_id}"

HEADERS = {
    "Content-Type": "application/json",
    "brand": "daft",
    "platform": "web",
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Origin": "https://www.daft.ie",
    "Referer": "https://www.daft.ie/",
}

TIMEOUT = 30
PAGE_SIZE = 100
DETAIL_DELAY_S = 0.15

EARTH_RADIUS_M = 6_371_000

_COMMERCIAL_TYPES = frozenset(
    {
        "commercial",
        "office space",
        "industrial",
        "retail",
        "agricultural",
        "site",
    }
)


def _now_iso() -> str:
    return datetime.now(tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


def parse_price_eur(text: str | None) -> int | None:
    if not text:
        return None
    lowered = text.lower()
    if "negotiable" in lowered or "price on application" in lowered:
        return None
    m = re.search(r"€\s*([\d,]+)", text.replace(",", ""))
    if not m:
        return None
    return int(m.group(1))


def parse_beds(text: str | None) -> int | None:
    if not text:
        return None
    lowered = text.lower()
    if "studio" in lowered:
        return 0
    nums = [int(x) for x in re.findall(r"\d+", text)]
    return max(nums) if nums else None


def parse_sqm_value(raw) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, dict):
        for key in ("size", "value", "amount"):
            if key in raw:
                return parse_sqm_value(raw[key])
        return None
    text = str(raw)
    m = re.search(r"(\d+)\s*(?:sq\.?\s*m|m²|square\s*metre)", text, re.I)
    return int(m.group(1)) if m else None


def is_residential_rent(listing: dict) -> bool:
    category = (listing.get("category") or "").lower()
    if category and category != "rent":
        return False
    prop_type = (listing.get("propertyType") or "").lower()
    if any(t in prop_type for t in _COMMERCIAL_TYPES):
        return False
    sections = [s.lower() for s in listing.get("sections") or []]
    if "commercial" in sections:
        return False
    return True


def listing_coords(listing: dict) -> tuple[float, float] | None:
    point = listing.get("point") or {}
    coords = point.get("coordinates")
    if not coords or len(coords) < 2:
        return None
    lon, lat = float(coords[0]), float(coords[1])
    return lat, lon


def matches_market(
    listing: dict,
    market: MarketCriteria,
    *,
    beds: int | None,
    sqm: int | None,
    price_eur: int | None,
) -> tuple[bool, int | None]:
    coords = listing_coords(listing)
    if not coords:
        return False, None
    lat, lon = coords
    dist = int(haversine_m(market.center_lat, market.center_lon, lat, lon))
    if dist > market.radius_m:
        return False, dist

    if market.max_price_eur is not None and price_eur is not None:
        if price_eur > market.max_price_eur:
            return False, dist

    bed_ok = beds is not None and beds >= market.min_beds
    sqm_ok = sqm is not None and sqm >= market.min_sqm
    if not (bed_ok or sqm_ok):
        return False, dist
    return True, dist


def _search_payload(*, from_offset: int, price_max: int | None) -> dict:
    filters: list[dict] = []
    if price_max is not None:
        filters.append({"name": "rentalPrice", "values": ["0", str(price_max)]})
    return {
        "section": "rent",
        "filters": filters,
        "paging": {"from": str(from_offset), "pageSize": str(PAGE_SIZE)},
    }


def fetch_listings_page(from_offset: int, price_max: int | None) -> dict:
    resp = requests.post(
        DAFT_LISTINGS_URL,
        headers=HEADERS,
        json=_search_payload(from_offset=from_offset, price_max=price_max),
        timeout=TIMEOUT,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_listing_detail(daft_id: int) -> dict | None:
    time.sleep(DETAIL_DELAY_S)
    try:
        resp = requests.get(
            DAFT_DETAIL_URL.format(daft_id=daft_id),
            headers={k: v for k, v in HEADERS.items() if k != "Content-Type"},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("listing") or data
    except Exception as exc:
        logger.warning("Detail fetch failed for %s: %s", daft_id, exc)
        return None


def enrich_listing(listing: dict, market: MarketCriteria) -> tuple[int | None, int | None, int | None]:
    price_eur = parse_price_eur(listing.get("price") or listing.get("abbreviatedPrice"))
    beds = parse_beds(listing.get("numBedrooms"))
    sqm = parse_sqm_value(listing.get("propertySize") or listing.get("floorArea"))

    bed_ok = beds is not None and beds >= market.min_beds
    sqm_ok = sqm is not None and sqm >= market.min_sqm
    if not bed_ok and not sqm_ok:
        detail = fetch_listing_detail(int(listing["id"]))
        if detail:
            if beds is None:
                beds = parse_beds(detail.get("numBedrooms"))
            if sqm is None:
                sqm = parse_sqm_value(detail.get("propertySize") or detail.get("floorArea"))
            if price_eur is None:
                price_eur = parse_price_eur(detail.get("price") or detail.get("abbreviatedPrice"))
    return beds, sqm, price_eur


def in_scan_region(lat: float, lon: float, market: MarketCriteria) -> bool:
    """Skip listings far from the market when scanning all-Ireland results."""
    return haversine_m(market.center_lat, market.center_lon, lat, lon) <= 50_000


def listing_url(daft_id: int, seo_title: str | None) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", (seo_title or "listing").lower()).strip("-")
    return f"https://www.daft.ie/rental-property/{slug}/{daft_id}"


def sync_market(market_slug: str) -> dict:
    init_db()
    market = MARKETS[market_slug]
    started = _now_iso()
    run_id = None
    seen_ids: set[int] = set()
    matched_rows: list[dict] = []
    pages = 0
    error = None

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO sync_runs (market_slug, started_at, status)
            VALUES (?, ?, 'running')
            """,
            (market_slug, started),
        )
        run_id = cur.lastrowid

    try:
        from_offset = 0
        total_results = None
        while True:
            data = fetch_listings_page(from_offset, market.max_price_eur)
            pages += 1
            paging = data.get("paging") or {}
            if total_results is None:
                total_results = int(paging.get("totalResults") or 0)
            batch = data.get("listings") or []
            if not batch:
                break

            for item in batch:
                listing = item.get("listing") or item
                if not is_residential_rent(listing):
                    continue
                coords = listing_coords(listing)
                if not coords:
                    continue
                lat, lon = coords
                if market.max_price_eur is None and not in_scan_region(lat, lon, market):
                    continue
                daft_id = int(listing["id"])
                beds, sqm, price_eur = enrich_listing(listing, market)
                ok, dist = matches_market(
                    listing, market, beds=beds, sqm=sqm, price_eur=price_eur
                )
                if not ok:
                    continue
                coords = listing_coords(listing)
                if not coords:
                    continue
                lat, lon = coords
                seen_ids.add(daft_id)
                matched_rows.append(
                    {
                        "daft_id": daft_id,
                        "title": listing.get("title") or "",
                        "url": listing_url(daft_id, listing.get("seoTitle")),
                        "lat": lat,
                        "lon": lon,
                        "distance_m": dist,
                        "price_eur": price_eur,
                        "beds": beds,
                        "sqm": sqm,
                        "property_type": listing.get("propertyType") or "",
                    }
                )

            from_offset += PAGE_SIZE
            if from_offset >= total_results:
                break

        now = _now_iso()
        with get_db() as conn:
            prev_active = {
                r["daft_id"]
                for r in conn.execute(
                    "SELECT daft_id FROM listings WHERE market_slug = ? AND active = 1",
                    (market_slug,),
                ).fetchall()
            }

            for row in matched_rows:
                existing = conn.execute(
                    "SELECT id, first_seen_at FROM listings WHERE market_slug = ? AND daft_id = ?",
                    (market_slug, row["daft_id"]),
                ).fetchone()
                if existing:
                    conn.execute(
                        """
                        UPDATE listings SET
                            title = ?, url = ?, lat = ?, lon = ?, distance_m = ?,
                            price_eur = ?, beds = ?, sqm = ?, property_type = ?,
                            last_seen_at = ?, active = 1
                        WHERE id = ?
                        """,
                        (
                            row["title"],
                            row["url"],
                            row["lat"],
                            row["lon"],
                            row["distance_m"],
                            row["price_eur"],
                            row["beds"],
                            row["sqm"],
                            row["property_type"],
                            now,
                            existing["id"],
                        ),
                    )
                else:
                    conn.execute(
                        """
                        INSERT INTO listings (
                            market_slug, daft_id, title, url, lat, lon, distance_m,
                            price_eur, beds, sqm, property_type,
                            first_seen_at, last_seen_at, active
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                        """,
                        (
                            market_slug,
                            row["daft_id"],
                            row["title"],
                            row["url"],
                            row["lat"],
                            row["lon"],
                            row["distance_m"],
                            row["price_eur"],
                            row["beds"],
                            row["sqm"],
                            row["property_type"],
                            now,
                            now,
                        ),
                    )

            if seen_ids:
                placeholders = ",".join("?" * len(seen_ids))
                conn.execute(
                    f"""
                    UPDATE listings SET active = 0
                    WHERE market_slug = ? AND active = 1
                      AND daft_id NOT IN ({placeholders})
                    """,
                    (market_slug, *seen_ids),
                )
            else:
                conn.execute(
                    "UPDATE listings SET active = 0 WHERE market_slug = ? AND active = 1",
                    (market_slug,),
                )

            new_ids = seen_ids - prev_active
            removed_ids = prev_active - seen_ids
            active_count = len(seen_ids)

            conn.execute(
                """
                INSERT INTO stock_snapshots (
                    market_slug, counted_at, active_count, new_count, removed_count
                ) VALUES (?, ?, ?, ?, ?)
                """,
                (market_slug, now, active_count, len(new_ids), len(removed_ids)),
            )

            conn.execute(
                """
                UPDATE sync_runs SET
                    finished_at = ?, status = 'ok',
                    pages_fetched = ?, listings_matched = ?
                WHERE id = ?
                """,
                (now, pages, len(matched_rows), run_id),
            )

        return {
            "market": market_slug,
            "matched": len(matched_rows),
            "new": len(new_ids),
            "removed": len(removed_ids),
            "pages": pages,
        }

    except Exception as exc:
        error = str(exc)
        logger.exception("Sync failed for %s", market_slug)
        with get_db() as conn:
            conn.execute(
                """
                UPDATE sync_runs SET finished_at = ?, status = 'error',
                    pages_fetched = ?, error = ?
                WHERE id = ?
                """,
                (_now_iso(), pages, error, run_id),
            )
        raise


def sync_all_markets() -> list[dict]:
    results = []
    for slug in MARKETS:
        logger.info("Syncing market %s", slug)
        results.append(sync_market(slug))
    return results
