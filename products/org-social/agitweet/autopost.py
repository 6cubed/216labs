"""Compose Agitweet posts (RSS news + philosophy prompts) for cron / internal API."""

from __future__ import annotations

import hashlib
import json
import os
import random
import re
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Any

_HARNESS_PATH = Path(__file__).resolve().parent / "autopost_harness.json"


def _state_path() -> Path:
    raw = os.environ.get("AGITWEET_AUTOPOST_STATE_PATH", "").strip()
    if raw:
        return Path(raw)
    container = Path("/app/data/autopost_news_state.json")
    try:
        container.parent.mkdir(parents=True, exist_ok=True)
        return container
    except OSError:
        return _HARNESS_PATH.parent / "data" / "autopost_news_state.json"
_USER_AGENT = "216labs-agitweet/1.0 (+https://agitweet.6cubed.app)"
_STRIP_TAGS = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class NewsHeadline:
    title: str
    source: str
    link: str
    item_id: str


def _load_harness() -> dict[str, Any]:
    if not _HARNESS_PATH.is_file():
        return {}
    try:
        data = json.loads(_HARNESS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _max_len(harness: dict[str, Any]) -> int:
    raw = harness.get("max_len")
    if isinstance(raw, (int, float)):
        return max(80, min(1000, int(raw)))
    return 260


def _prompt_pool(harness: dict[str, Any]) -> list[str]:
    raw = harness.get("prompt_pool")
    if isinstance(raw, list):
        out = [str(p).strip() for p in raw if isinstance(p, str) and str(p).strip()]
        if out:
            return out
    return ["216labs: ship small, compound relentlessly."]


def _news_feeds(harness: dict[str, Any]) -> list[dict[str, str]]:
    raw = harness.get("news_feeds")
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        url = str(item.get("url") or "").strip()
        if url:
            out.append(
                {
                    "url": url,
                    "source": str(item.get("source") or item.get("name") or "News").strip(),
                }
            )
    return out


def _news_reactions(harness: dict[str, Any]) -> list[str]:
    raw = harness.get("news_reactions")
    if isinstance(raw, list):
        out = [str(p).strip() for p in raw if isinstance(p, str) and str(p).strip()]
        if out:
            return out
    return ["Worth watching."]


def _news_weight(harness: dict[str, Any]) -> float:
    raw = harness.get("news_weight")
    if isinstance(raw, (int, float)):
        return max(0.0, min(1.0, float(raw)))
    return 0.55


def _clean_text(raw: str) -> str:
    t = unescape(_STRIP_TAGS.sub("", raw or ""))
    return re.sub(r"\s+", " ", t).strip()


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if "}" in tag else tag


def _parse_rss(xml_bytes: bytes, source: str, limit: int) -> list[NewsHeadline]:
    root = ET.fromstring(xml_bytes)
    items: list[NewsHeadline] = []
    for elem in root.iter():
        if _local(elem.tag) not in ("item", "entry"):
            continue
        title = ""
        link = ""
        for child in elem:
            tag = _local(child.tag)
            if tag == "title" and child.text:
                title = _clean_text(child.text)
            elif tag == "link":
                if child.text and child.text.strip():
                    link = child.text.strip()
                elif child.get("href"):
                    link = child.get("href", "").strip()
        if not title:
            continue
        if not link:
            link = title
        item_id = hashlib.sha256(link.encode()).hexdigest()[:24]
        items.append(NewsHeadline(title=title, source=source, link=link, item_id=item_id))
        if len(items) >= limit:
            break
    return items


def _fetch_feed(url: str, source: str) -> list[NewsHeadline]:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return _parse_rss(resp.read(), source, 12)
    except (urllib.error.URLError, OSError, TimeoutError, ET.ParseError):
        return []


def _pick_headline(feeds: list[dict[str, str]]) -> NewsHeadline | None:
    if not feeds:
        return None
    state: dict[str, Any] = {"posted_ids": []}
    state_path = _state_path()
    if state_path.is_file():
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except Exception:
            pass
    posted = set(state.get("posted_ids") or [])
    shuffled = list(feeds)
    random.shuffle(shuffled)
    candidates: list[NewsHeadline] = []
    for entry in shuffled:
        candidates.extend(_fetch_feed(entry["url"], entry["source"]))
    if not candidates:
        return None
    random.shuffle(candidates)
    fresh = [h for h in candidates if h.item_id not in posted]
    pick = fresh[0] if fresh else candidates[0]
    posted_list = list(posted)
    if pick.item_id not in posted_list:
        posted_list.append(pick.item_id)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps({"posted_ids": posted_list[-250:]}, indent=0),
        encoding="utf-8",
    )
    return pick


def _format_news(headline: NewsHeadline, reaction: str, max_len: int) -> str:
    title, source = headline.title, headline.source
    budget = max_len - len(reaction) - len(source) - 6
    if budget < 40:
        budget = max_len - 20
    if len(title) > budget:
        title = title[: max(0, budget - 1)].rstrip() + "…"
    body = f"📰 {title} ({source})\n{reaction}"
    if len(body) <= max_len:
        return body
    return body[: max(0, max_len - 1)].rstrip() + "…"


def compose_post() -> str:
    harness = _load_harness()
    ml = _max_len(harness)
    feeds = _news_feeds(harness)
    if feeds and random.random() < _news_weight(harness):
        headline = _pick_headline(feeds)
        if headline:
            reaction = random.choice(_news_reactions(harness))
            return _format_news(headline, reaction, ml)
    text = random.choice(_prompt_pool(harness)).strip()
    if len(text) <= ml:
        return text
    return text[: max(0, ml - 1)].rstrip() + "…"
