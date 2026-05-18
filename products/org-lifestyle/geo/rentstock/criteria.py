"""Search criteria for tracked rental markets."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class MarketCriteria:
    slug: str
    name: str
    center_lat: float
    center_lon: float
    radius_m: int
    min_beds: int
    min_sqm: int
    max_price_eur: int | None
    criteria_summary: str


MARKETS: dict[str, MarketCriteria] = {
    "dublin": MarketCriteria(
        slug="dublin",
        name="Dublin — Temple Bar",
        center_lat=53.3456,
        center_lon=-6.2675,
        radius_m=3000,
        min_beds=3,
        min_sqm=90,
        max_price_eur=600_000,
        criteria_summary="3+ beds or 90+ m² · within 3 km of Temple Bar · asking ≤ €600k",
    ),
    "galway": MarketCriteria(
        slug="galway",
        name="Galway — Eyre Square",
        center_lat=53.2744,
        center_lon=-9.0490,
        radius_m=3000,
        min_beds=4,
        min_sqm=100,
        max_price_eur=None,
        criteria_summary="4+ beds or 100+ m² · within 3 km of Eyre Square",
    ),
}
