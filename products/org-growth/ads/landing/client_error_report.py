"""Report server errors to admin centralized ingest."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

_APP_ID = "landing"
_ENDPOINT = os.environ.get(
    "CLIENT_ERROR_REPORT_URL", "http://admin:3000/api/public/report-error"
)


def report_server_error(
    message: str,
    *,
    stack: str = "",
    url: str = "",
) -> None:
    if not message.strip():
        return
    body = json.dumps(
        {
            "app_id": _APP_ID,
            "kind": "server",
            "message": message.strip()[:2000],
            "stack": (stack or "")[:8000] or None,
            "url": (url or "")[:500] or None,
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        _ENDPOINT,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            resp.read(256)
    except (urllib.error.URLError, OSError, TimeoutError, ValueError):
        pass
