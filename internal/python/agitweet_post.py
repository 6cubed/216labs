"""Post approved DiffTinder ideas to Agitweet (stdlib HTTP, no extra deps)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


def _internal_base() -> str:
    return os.environ.get("AGITWEET_INTERNAL_URL", "http://agitweet:5000").strip().rstrip("/")


def _api_token() -> str:
    return os.environ.get("AGITWEET_API_TOKEN", "").strip()


def agitweet_publish_configured() -> bool:
    return bool(_api_token())


def format_approved_post(*, day_utc: str, title: str | None, body: str) -> str:
    head = f"DiffTinder yes · {day_utc}"
    if title:
        head = f"{head} · {title}"
    text = f"{head}\n\n{body.strip()}"
    if len(text) > 1000:
        text = text[:997] + "…"
    return text


def post_text(text: str, *, timeout_sec: int = 15) -> tuple[bool, str]:
    token = _api_token()
    if not token:
        return False, "not_configured"
    if not text.strip():
        return False, "empty_text"

    url = f"{_internal_base()}/api/posts"
    payload = json.dumps({"text": text.strip()}).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            if 200 <= resp.status < 300:
                return True, "posted"
            return False, f"http_{resp.status}"
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = (e.read() or b"").decode("utf-8", errors="replace")[:200]
        except Exception:
            pass
        return False, f"http_{e.code}:{body or 'error'}"
    except Exception as e:
        return False, str(e)[:200]


def publish_approved_idea(*, day_utc: str, title: str | None, body: str) -> tuple[bool, str]:
    text = format_approved_post(day_utc=day_utc, title=title, body=body)
    return post_text(text)
