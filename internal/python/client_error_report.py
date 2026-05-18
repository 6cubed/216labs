"""Best-effort POST of server errors to admin ingest (Docker network or public URL)."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

DEFAULT_INTERNAL = "http://admin:3000/api/public/report-error"


def report_server_error(
    app_id: str,
    message: str,
    *,
    stack: str = "",
    url: str = "",
    endpoint: str | None = None,
) -> None:
    base = (endpoint or os.environ.get("CLIENT_ERROR_REPORT_URL") or DEFAULT_INTERNAL).strip()
    if not base or not app_id or not message.strip():
        return
    body = json.dumps(
        {
            "app_id": app_id.strip().lower(),
            "kind": "server",
            "message": message.strip()[:2000],
            "stack": (stack or "")[:8000] or None,
            "url": (url or "")[:500] or None,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        base,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            resp.read(256)
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        pass
