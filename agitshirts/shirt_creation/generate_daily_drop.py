from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Any

import requests


def _today_iso() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def load_drop_data(data_file: Path) -> dict[str, Any]:
    if not data_file.exists():
        return {"meta": {}, "drop": None, "history": []}

    try:
        return json.loads(data_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"meta": {}, "drop": None, "history": []}


def _save_drop_data(data_file: Path, data: dict[str, Any]) -> None:
    data_file.parent.mkdir(parents=True, exist_ok=True)
    data_file.write_text(json.dumps(data, indent=2), encoding="utf-8")


def _fallback_drop(date_iso: str) -> dict[str, Any]:
    palettes = [
        ("Jet Black", "Signal Red"),
        ("Stone Gray", "Neon Cyan"),
        ("Vintage White", "Royal Purple"),
        ("Midnight Blue", "Solar Yellow"),
        ("Forest Green", "Cream"),
    ]
    themes = [
        ("Algorithmic Rebellion", "Glitched propaganda poster style"),
        ("Human Loop", "Hand-drawn robots and analog controls"),
        ("Codepunk Riot", "Bold block typography with circuit noise"),
        ("Silent Uprising", "Minimal iconography with striking symmetry"),
        ("Neon Workers", "Retro-future labor movement motif"),
    ]

    seed = int(hashlib.sha256(date_iso.encode("utf-8")).hexdigest()[:8], 16)
    palette = palettes[seed % len(palettes)]
    theme = themes[(seed // 3) % len(themes)]

    edition_size = 72 + (seed % 145)
    price_usd = 32 + (seed % 8)
    sku = f"AGIT-{date_iso.replace('-', '')}"

    return {
        "title": f"{theme[0]} / {date_iso}",
        "concept": f"{theme[0]} inspired by daily machine-human tension.",
        "ai_rationale": (
            "Fallback generator selected a deterministic concept for reproducibility "
            "without external model access."
        ),
        "design_prompt": (
            f"{theme[1]}, high-contrast screenprint design, centered chest graphic, "
            f"2-color ink with accents, wearable streetwear aesthetic."
        ),
        "colorway": f"{palette[0]} tee with {palette[1]} ink",
        "edition_size": edition_size,
        "price_usd": price_usd,
        "sku": sku,
        "source_model": "fallback-deterministic",
        "image_url": "",
    }


def _openai_drop(date_iso: str, api_key: str, model: str) -> dict[str, Any]:
    prompt = f"""
Generate one limited-edition t-shirt product drop for date {date_iso}.
Return strict JSON with this exact shape:
{{
  "title": "string",
  "concept": "string",
  "ai_rationale": "string",
  "design_prompt": "string",
  "colorway": "string",
  "edition_size": integer between 50 and 300,
  "price_usd": integer between 24 and 60,
  "sku": "string",
  "image_url": "string (optional, can be empty)"
}}
Constraints:
- Product must feel premium, collectible, and wearable.
- Keep title under 60 characters.
- Keep concept under 180 characters.
- Keep design_prompt under 280 characters.
- SKU must start with "AGIT-".
- Output ONLY valid JSON.
""".strip()

    response = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0.9,
            "messages": [
                {"role": "system", "content": "You are a product creative director."},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=25,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    result = json.loads(content)
    result["source_model"] = model
    return result


def _checkout_url(base_checkout_url: str, sku: str) -> str:
    if not base_checkout_url:
        return "#"
    separator = "&" if "?" in base_checkout_url else "?"
    return f"{base_checkout_url}{separator}client_reference_id={sku}"


def generate_or_load_daily_drop(
    data_file: Path,
    openai_api_key: str | None,
    checkout_base_url: str,
    model: str,
) -> dict[str, Any]:
    data = load_drop_data(data_file)
    today = _today_iso()
    existing = data.get("drop")

    if isinstance(existing, dict) and existing.get("date") == today:
        return data

    try:
        if openai_api_key:
            drop_core = _openai_drop(today, openai_api_key, model)
        else:
            drop_core = _fallback_drop(today)
    except Exception:
        drop_core = _fallback_drop(today)

    daily_drop = {
        "date": today,
        "generated_at": _utc_now_iso(),
        **drop_core,
    }
    daily_drop["checkout_url"] = _checkout_url(checkout_base_url, daily_drop["sku"])

    history = data.get("history", [])
    if not isinstance(history, list):
        history = []
    history = [daily_drop] + [item for item in history if isinstance(item, dict)][:29]

    full_data = {
        "meta": {
            "last_generated_at": daily_drop["generated_at"],
            "generation_date": today,
            "source_model": daily_drop.get("source_model", "unknown"),
        },
        "drop": daily_drop,
        "history": history,
    }
    _save_drop_data(data_file, full_data)
    return full_data
