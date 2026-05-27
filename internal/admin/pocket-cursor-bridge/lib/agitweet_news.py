"""Fetch recent headlines from world-news RSS feeds for Agitweet posts."""

from __future__ import annotations

import hashlib
import json
import random
import re
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from dataclasses import dataclass
from html import unescape
from pathlib import Path
from typing import Any

_USER_AGENT = "216labs-agitweet/1.0 (+https://agitweet.6cubed.app)"
_STRIP_TAGS = re.compile(r"<[^>]+>")


@dataclass(frozen=True)
class NewsHeadline:
    title: str
    source: str
    link: str
    item_id: str


def _clean_text(raw: str) -> str:
    t = unescape(_STRIP_TAGS.sub("", raw or ""))
    t = re.sub(r"\s+", " ", t).strip()
    return t


def _local(tag: str) -> str:
    if "}" in tag:
        return tag.rsplit("}", 1)[-1]
    return tag


def _parse_rss_items(xml_bytes: bytes, source: str, limit: int) -> list[NewsHeadline]:
    root = ET.fromstring(xml_bytes)
    items: list[NewsHeadline] = []
    for elem in root.iter():
        if _local(elem.tag) != "item" and _local(elem.tag) != "entry":
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
        item_id = hashlib.sha256(link.encode("utf-8")).hexdigest()[:24]
        items.append(NewsHeadline(title=title, source=source, link=link, item_id=item_id))
        if len(items) >= limit:
            break
    return items


def fetch_feed(url: str, source: str, *, timeout_sec: int = 12, per_feed: int = 12) -> list[NewsHeadline]:
    req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = resp.read()
    except (urllib.error.URLError, OSError, TimeoutError) as e:
        print(f"[agitweet] RSS fetch failed ({source}): {e}")
        return []
    try:
        return _parse_rss_items(data, source, per_feed)
    except ET.ParseError as e:
        print(f"[agitweet] RSS parse failed ({source}): {e}")
        return []


def _load_state(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return {"posted_ids": []}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("posted_ids"), list):
            return data
    except Exception:
        pass
    return {"posted_ids": []}


def _save_state(path: Path, posted_ids: list[str], *, max_ids: int = 250) -> None:
    trimmed = posted_ids[-max_ids:]
    path.write_text(json.dumps({"posted_ids": trimmed}, indent=0), encoding="utf-8")


def pick_headline(
    feeds: list[dict[str, str]],
    state_path: Path,
    *,
    timeout_sec: int = 12,
) -> NewsHeadline | None:
    if not feeds:
        return None
    state = _load_state(state_path)
    posted = set(state.get("posted_ids") or [])
    shuffled = list(feeds)
    random.shuffle(shuffled)
    candidates: list[NewsHeadline] = []
    for entry in shuffled:
        url = str(entry.get("url") or "").strip()
        source = str(entry.get("source") or entry.get("name") or "News").strip()
        if not url:
            continue
        candidates.extend(fetch_feed(url, source, timeout_sec=timeout_sec))
    if not candidates:
        return None
    random.shuffle(candidates)
    fresh = [h for h in candidates if h.item_id not in posted]
    pick = fresh[0] if fresh else candidates[0]
    posted_list = list(posted)
    if pick.item_id not in posted_list:
        posted_list.append(pick.item_id)
    _save_state(state_path, posted_list)
    return pick


def format_news_post(
    headline: NewsHeadline,
    reaction: str,
    *,
    max_len: int,
) -> str:
    title = headline.title
    source = headline.source
    # Leave room for reaction + attribution.
    budget = max_len - len(reaction) - len(source) - 6
    if budget < 40:
        budget = max_len - 20
    if len(title) > budget:
        title = title[: max(0, budget - 1)].rstrip() + "…"
    body = f"📰 {title} ({source})\n{reaction}"
    if len(body) <= max_len:
        return body
    return body[: max(0, max_len - 1)].rstrip() + "…"


def compose_from_news(
    feeds: list[dict[str, str]],
    reactions: list[str],
    state_path: Path,
    *,
    max_len: int,
    timeout_sec: int = 12,
) -> str | None:
    headline = pick_headline(feeds, state_path, timeout_sec=timeout_sec)
    if not headline:
        return None
    reaction = random.choice(reactions) if reactions else "Worth watching."
    return format_news_post(headline, reaction, max_len=max_len)
