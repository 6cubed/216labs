"""Shared HTTP helpers for 216labs Python services (stdlib only).

Use for JSON fetches and probes with consistent timeouts, User-Agent, and error handling.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

DEFAULT_USER_AGENT = "216labs-http/1.0 (+https://6cubed.app)"


def fetch_json(
    url: str,
    *,
    timeout: float = 10.0,
    headers: dict[str, str] | None = None,
    default: Any = None,
) -> Any:
    """GET *url*, parse JSON body. Return *default* on any failure (network, HTTP error, bad JSON)."""
    u = (url or "").strip()
    if not u:
        return default
    h = {"Accept": "application/json", "User-Agent": DEFAULT_USER_AGENT}
    if headers:
        h.update(headers)
    req = urllib.request.Request(u, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        return json.loads(raw)
    except (
        urllib.error.URLError,
        urllib.error.HTTPError,
        TimeoutError,
        OSError,
        json.JSONDecodeError,
        UnicodeDecodeError,
        TypeError,
        ValueError,
    ):
        return default


def http_probe(
    url: str,
    timeout_s: float,
    *,
    max_bytes: int = 5000,
    user_agent: str = "quality-factory/1.0",
) -> tuple[int | None, str]:
    """GET *url*; return (status_code, body_prefix) or (None, error_message). Handles HTTP errors with body."""
    req = urllib.request.Request(url, headers={"User-Agent": user_agent})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read(max_bytes).decode("utf-8", errors="replace")
            return int(resp.getcode()), body
    except urllib.error.HTTPError as e:
        try:
            body = e.read(max_bytes).decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return int(e.code), body
    except Exception as e:
        return None, str(e)


def normalize_blog_items(data: Any, *, max_items: int = 10) -> list[dict[str, str]]:
    """Turn blog /api/feed JSON into a list of {title, excerpt, date, url} dicts."""
    if not isinstance(data, dict):
        return []
    items = data.get("items") or []
    if not isinstance(items, list):
        return []
    out: list[dict[str, str]] = []
    for it in items[:max_items]:
        if not isinstance(it, dict):
            continue
        t = (it.get("title") or "").strip()
        u = (it.get("url") or "").strip()
        if not t or not u:
            continue
        out.append(
            {
                "title": t,
                "excerpt": (it.get("excerpt") or "").strip(),
                "date": (it.get("date") or "").strip(),
                "url": u,
            }
        )
    return out
