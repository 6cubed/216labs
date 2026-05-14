"""Meta WhatsApp Cloud API helpers (webhook verify, HMAC signature, inbound parse, outbound text).

Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
"""

from __future__ import annotations

import hashlib
import hmac
import json
from typing import Any, Callable
from urllib.parse import parse_qs
from urllib.request import Request, urlopen


def verify_hub_challenge(query_string: str, verify_token: str) -> str | None:
    """Handle GET webhook verification. Returns hub.challenge string or None."""
    qs = parse_qs(query_string)
    mode = (qs.get("hub.mode") or [""])[0]
    token = (qs.get("hub.verify_token") or [""])[0]
    challenge = (qs.get("hub.challenge") or [""])[0]
    if mode == "subscribe" and token == verify_token and challenge:
        return challenge
    return None


def verify_signature_sha256(raw_body: bytes, x_hub_signature_256: str, app_secret: str) -> bool:
    """Validate X-Hub-Signature-256 from Meta (sha256=<hex>)."""
    if not app_secret or not x_hub_signature_256 or not x_hub_signature_256.startswith("sha256="):
        return False
    expected_hex = x_hub_signature_256.split("=", 1)[1].strip().lower()
    digest = hmac.new(app_secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    try:
        return hmac.compare_digest(digest, expected_hex)
    except TypeError:
        return False


def parse_inbound_text_messages(payload: Any) -> list[dict[str, str]]:
    """Extract simple text messages from a webhook JSON body.

    Each item: {"from": "<wa_id>", "text": "<body>", "id": "<wamid>"}
    """
    out: list[dict[str, str]] = []
    if not isinstance(payload, dict):
        return out
    if payload.get("object") != "whatsapp_business_account":
        return out
    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes") or []:
            if not isinstance(change, dict):
                continue
            val = change.get("value")
            if not isinstance(val, dict):
                continue
            for msg in val.get("messages") or []:
                if not isinstance(msg, dict):
                    continue
                if msg.get("type") != "text":
                    continue
                text_obj = msg.get("text")
                if not isinstance(text_obj, dict):
                    continue
                body = (text_obj.get("body") or "").strip()
                from_id = str(msg.get("from") or "").strip()
                mid = str(msg.get("id") or "").strip()
                if from_id and body:
                    out.append({"from": from_id, "text": body, "id": mid})
    return out


def send_text_message(
    *,
    phone_number_id: str,
    access_token: str,
    to_wa_id: str,
    text: str,
    api_version: str = "v21.0",
) -> tuple[bool, str]:
    """POST a plain text message. Returns (ok, detail)."""
    url = f"https://graph.facebook.com/{api_version}/{phone_number_id}/messages"
    body = json.dumps(
        {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": to_wa_id,
            "type": "text",
            "text": {"preview_url": False, "body": text[:4096]},
        }
    ).encode("utf-8")
    req = Request(
        url,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urlopen(req, timeout=45) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
        data = json.loads(raw) if raw else {}
        if isinstance(data, dict) and data.get("error"):
            err = data["error"]
            return False, str(err.get("message", err))
        return True, "ok"
    except Exception as e:
        return False, str(e)


def parse_allowed_from(raw: str) -> set[str]:
    """Normalize allowlist: digits only, no + prefix."""
    s: set[str] = set()
    for part in (raw or "").split(","):
        p = "".join(ch for ch in part.strip() if ch.isdigit())
        if p:
            s.add(p)
    return s
