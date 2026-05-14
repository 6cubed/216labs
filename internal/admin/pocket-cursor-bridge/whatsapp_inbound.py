"""
Inbound WhatsApp (Meta Cloud API) → PocketCursor CDP.

Runs a small stdlib HTTP server in a daemon thread. Telegram remains the
primary transport for Cursor→phone; this path only forwards WhatsApp text
into Cursor (same as typing with a [WhatsApp] prefix).

Requires a public HTTPS URL for Meta webhooks (e.g. ngrok http WHATSAPP_WEBHOOK_PORT).
"""

from __future__ import annotations

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Callable
from urllib.parse import urlparse

from lib.whatsapp_cloud import (
    parse_allowed_from,
    parse_inbound_text_messages,
    verify_hub_challenge,
    verify_signature_sha256,
)

OnText = Callable[[str, str], None]


def _truthy(name: str) -> bool:
    return os.environ.get(name, "").strip().lower() in ("1", "true", "yes", "on")


def whatsapp_inbound_configured() -> bool:
    if not _truthy("WHATSAPP_CLOUD_ENABLED"):
        return False
    need = (
        "WHATSAPP_WEBHOOK_APP_SECRET",
        "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_ALLOWED_FROM",
    )
    return all(os.environ.get(k, "").strip() for k in need)


def make_handler(
    *,
    app_secret: str,
    verify_token: str,
    allowed: set[str],
    on_text: OnText,
    log: Callable[[str], None],
) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, fmt: str, *args) -> None:  # noqa: A003
            log(f"[whatsapp] {self.address_string()} - {fmt % args}")

        def do_GET(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path not in ("/", "/webhook", "/whatsapp"):
                self.send_error(404)
                return
            challenge = verify_hub_challenge(parsed.query or "", verify_token)
            if challenge is None:
                self.send_error(403, "verify failed")
                return
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.end_headers()
            self.wfile.write(challenge.encode("utf-8"))

        def do_POST(self) -> None:  # noqa: N802
            parsed = urlparse(self.path)
            if parsed.path not in ("/", "/webhook", "/whatsapp"):
                self.send_error(404)
                return
            length = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(length) if length > 0 else b""
            sig = (self.headers.get("X-Hub-Signature-256") or "").strip()
            if not verify_signature_sha256(raw, sig, app_secret):
                log("[whatsapp] rejected POST (bad or missing signature)")
                self.send_error(403, "bad signature")
                return
            try:
                payload = json.loads(raw.decode("utf-8") if raw else "{}")
            except json.JSONDecodeError:
                self.send_response(200)
                self.end_headers()
                return
            for m in parse_inbound_text_messages(payload):
                wid = m["from"]
                if allowed and wid not in allowed:
                    log(f"[whatsapp] ignored message from non-allowlisted {wid}")
                    continue
                try:
                    on_text(wid, m["text"])
                except Exception as e:
                    log(f"[whatsapp] on_text error: {e}")
            self.send_response(200)
            self.end_headers()

    return Handler


def start_whatsapp_webhook_daemon(on_text: OnText, log: Callable[[str], None]) -> None:
    """Start HTTPServer in a daemon thread. No-op if not configured."""
    if not whatsapp_inbound_configured():
        return
    app_secret = os.environ["WHATSAPP_WEBHOOK_APP_SECRET"].strip()
    verify_token = os.environ["WHATSAPP_VERIFY_TOKEN"].strip()
    allowed_raw = os.environ.get("WHATSAPP_ALLOWED_FROM", "")
    allowed = parse_allowed_from(allowed_raw)
    host = os.environ.get("WHATSAPP_WEBHOOK_BIND", "127.0.0.1").strip() or "127.0.0.1"
    port_s = os.environ.get("WHATSAPP_WEBHOOK_PORT", "8792").strip() or "8792"
    port = int(port_s)
    handler = make_handler(
        app_secret=app_secret,
        verify_token=verify_token,
        allowed=allowed,
        on_text=on_text,
        log=log,
    )

    def run() -> None:
        httpd = HTTPServer((host, port), handler)
        log(f"[whatsapp] webhook listening on http://{host}:{port}/webhook (Meta callback path)")
        httpd.serve_forever()

    t = threading.Thread(target=run, name="whatsapp-webhook", daemon=True)
    t.start()
