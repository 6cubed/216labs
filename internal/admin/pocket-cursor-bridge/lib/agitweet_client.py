from __future__ import annotations

import os
from dataclasses import dataclass

import requests


@dataclass(frozen=True)
class AgitweetClientConfig:
    base_url: str
    api_token: str


def get_config() -> AgitweetClientConfig | None:
    base_url = os.environ.get("AGITWEET_BASE_URL", "").strip().rstrip("/")
    api_token = os.environ.get("AGITWEET_API_TOKEN", "").strip()
    if not base_url or not api_token:
        return None
    return AgitweetClientConfig(base_url=base_url, api_token=api_token)


def post(text: str, *, timeout_sec: int = 20) -> tuple[bool, str]:
    """
    Post a single message to Agitweet.

    Expected API (simple, stable):
      POST {AGITWEET_BASE_URL}/api/posts
      Authorization: Bearer {AGITWEET_API_TOKEN}
      JSON: { "text": "..." }
    """
    cfg = get_config()
    if not cfg:
        return False, "Agitweet is not configured (set AGITWEET_BASE_URL + AGITWEET_API_TOKEN)."
    if not text or not text.strip():
        return False, "Empty post text."

    url = f"{cfg.base_url}/api/posts"
    try:
        res = requests.post(
            url,
            json={"text": text.strip()},
            headers={
                "Authorization": f"Bearer {cfg.api_token}",
                "Content-Type": "application/json",
            },
            timeout=timeout_sec,
        )
    except Exception as e:
        return False, f"Agitweet request failed: {e}"

    if 200 <= res.status_code < 300:
        return True, "Posted."
    body = (res.text or "").strip()
    if len(body) > 240:
        body = body[:237] + "…"
    return False, f"Agitweet error {res.status_code}: {body or '(no body)'}"

