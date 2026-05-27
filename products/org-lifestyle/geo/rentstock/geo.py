"""Geo helpers for rentstock trackers."""

from __future__ import annotations

import math

from criteria import MARKETS, MarketCriteria


def tracker_center(
    center_lat: float | None,
    center_lon: float | None,
    market: MarketCriteria | None,
) -> tuple[float, float]:
    if center_lat is not None and center_lon is not None:
        return float(center_lat), float(center_lon)
    if market:
        return market.center_lat, market.center_lon
    return 0.0, 0.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * 6_371_000 * math.asin(math.sqrt(a))


def listing_ids_within_radius(
    conn,
    *,
    market_slug: str,
    center_lat: float,
    center_lon: float,
    radius_m: int,
    min_beds: int | None,
    max_price_eur: int | None,
) -> list[int]:
    """Return listing ids matching market + geo radius + optional bed/price filters."""
    rows = conn.execute(
        """
        SELECT id, lat, lon, beds, price_eur
        FROM listings
        WHERE market_slug = ? AND active = 1
          AND lat IS NOT NULL AND lon IS NOT NULL
        """,
        (market_slug,),
    ).fetchall()
    out: list[int] = []
    for r in rows:
        dist = int(haversine_m(center_lat, center_lon, float(r["lat"]), float(r["lon"])))
        if dist > radius_m:
            continue
        if min_beds is not None:
            beds = r["beds"]
            if beds is None or int(beds) < min_beds:
                continue
        if max_price_eur is not None:
            price = r["price_eur"]
            if price is None or int(price) > max_price_eur:
                continue
        out.append(int(r["id"]))
    return out


def count_listings_for_tracker(conn, t, market: MarketCriteria | None) -> int:
    radius_m = int(t["radius_m"] or (market.radius_m if market else 3000))
    clat, clon = tracker_center(t["center_lat"], t["center_lon"], market)
    min_beds = t["min_beds"]
    max_price = t["max_price_eur"]
    ids = listing_ids_within_radius(
        conn,
        market_slug=t["market_slug"],
        center_lat=clat,
        center_lon=clon,
        radius_m=radius_m,
        min_beds=min_beds,
        max_price_eur=max_price,
    )
    return len(ids)
