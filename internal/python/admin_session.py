"""Shared cookie session auth for internal admin panels (difftinder, etc.)."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

COOKIE_NAME = "labs_admin_session"
MAX_AGE_SEC = 60 * 60 * 24 * 14  # 14 days


def session_secret() -> str:
    for key in ("ADMIN_PANEL_SESSION_SECRET", "CRON_RUNNER_SECRET"):
        raw = os.environ.get(key, "").strip()
        if raw:
            return raw
    return ""


def panel_password() -> str:
    return os.environ.get("ADMIN_PANEL_PASSWORD", "").strip()


def auth_configured() -> bool:
    return bool(session_secret() and panel_password())


def verify_password(password: str) -> bool:
    want = panel_password()
    if not want or not password:
        return False
    return secrets.compare_digest(password, want)


def _sign(raw: bytes, secret: str) -> str:
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(raw + b"." + sig).decode().rstrip("=")


def _unsign(token: str, secret: str) -> dict | None:
    if not token or not secret:
        return None
    try:
        pad = "=" * (-len(token) % 4)
        blob = base64.urlsafe_b64decode(token + pad)
        dot = blob.rfind(b".")
        if dot <= 0:
            return None
        raw, sig = blob[:dot], blob[dot + 1 :]
        expect = hmac.new(secret.encode(), raw, hashlib.sha256).digest()
        if not secrets.compare_digest(sig, expect):
            return None
        data = json.loads(raw.decode("utf-8"))
        if not isinstance(data, dict):
            return None
        exp = int(data.get("exp") or 0)
        if exp < int(time.time()):
            return None
        return data
    except Exception:
        return None


def issue_session_cookie(response, *, secure: bool = True) -> None:
    secret = session_secret()
    if not secret:
        return
    payload = {"exp": int(time.time()) + MAX_AGE_SEC, "v": 1}
    raw = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    token = _sign(raw, secret)
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=MAX_AGE_SEC,
        httponly=True,
        samesite="Lax",
        secure=secure,
        path="/",
    )


def clear_session_cookie(response) -> None:
    response.set_cookie(COOKIE_NAME, "", max_age=0, path="/")


def session_valid(cookie_value: str | None) -> bool:
    secret = session_secret()
    if not secret:
        return False
    return _unsign(cookie_value or "", secret) is not None
