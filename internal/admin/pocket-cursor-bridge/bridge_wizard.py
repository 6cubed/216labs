#!/usr/bin/env python3
"""
Interactive Telegram setup for PocketCursor. Used by scripts/pocket-cursor-bridge.sh.

If a token is already set (env or merged .env files), the wizard prints a short summary
and asks before changing token, pinned .chat_id (DM vs group), and allowlist.

Optional WhatsApp (Meta Cloud API): after Telegram steps (or when skipping Telegram
reconfigure), offers an interactive WHATSAPP_* writer; or run bridge_wizard.py --whatsapp /
./scripts/pocket-cursor-bridge.sh --whatsapp for WhatsApp-only setup. See WHATSAPP.md.

Precedence matches pocket_cursor.py: process env wins; then .env.admin-sync; then .env.
"""
from __future__ import annotations

import argparse
import getpass
import os
import secrets
import sys
import time
from pathlib import Path

import requests

BRIDGE = Path(__file__).resolve().parent


def _parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return out
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        out[key] = val.strip()
    return out


def _merged_env_files() -> dict[str, str]:
    merged: dict[str, str] = {}
    merged.update(_parse_env_file(BRIDGE / ".env.admin-sync"))
    merged.update(_parse_env_file(BRIDGE / ".env"))
    return merged


def effective_telegram_token() -> str:
    merged = _merged_env_files()
    t = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if t:
        return t
    return merged.get("TELEGRAM_BOT_TOKEN", "").strip()


def read_chat_id_file() -> int | None:
    path = BRIDGE / ".chat_id"
    if not path.is_file():
        return None
    try:
        s = path.read_text(encoding="utf-8", errors="replace").strip()
        if s.lstrip("-").isdigit():
            return int(s)
    except OSError:
        pass
    return None


def _mask_token(t: str) -> str:
    t = t.strip()
    if len(t) <= 8:
        return "(set)"
    return f"{t[:4]}…{t[-4:]}"


def print_config_summary() -> None:
    tok = effective_telegram_token()
    merged = _merged_env_files()
    owner = merged.get("TELEGRAM_OWNER_ID", "").strip()
    allow = merged.get("TELEGRAM_ALLOWED_USER_IDS", "").strip()
    chat_id = read_chat_id_file()
    print("\n── Current bridge config (from env + .env files) ──")
    if tok:
        print(f"  Bot token: {_mask_token(tok)} (from env or .env)")
    else:
        print("  Bot token: (not set)")
    if allow:
        print(f"  TELEGRAM_ALLOWED_USER_IDS: {allow}")
    else:
        print("  TELEGRAM_ALLOWED_USER_IDS: (unset)")
    if owner:
        print(f"  TELEGRAM_OWNER_ID: {owner}")
    else:
        print("  TELEGRAM_OWNER_ID: (unset)")
    if chat_id is not None:
        kind = "group/supergroup" if chat_id < 0 else "DM / other"
        print(f"  Pinned .chat_id: {chat_id} ({kind})")
    else:
        print("  Pinned .chat_id: (none — next message can bind the chat)")
    print()


def tg_api(token: str, method: str, **params) -> dict:
    r = requests.post(
        f"https://api.telegram.org/bot{token}/{method}",
        json=params,
        timeout=60,
    )
    try:
        return r.json()
    except Exception:
        return {"ok": False, "description": r.text[:200]}


def validate_token(token: str) -> tuple[bool, str]:
    token = token.strip()
    if not token:
        return False, "Token is empty."
    data = tg_api(token, "getMe")
    if not data.get("ok"):
        return False, data.get("description", "Unknown error")
    un = data.get("result", {}).get("username", "?")
    return True, un


def upsert_env_file(path: Path, updates: dict[str, str | None]) -> None:
    """Set or remove keys. None removes KEY=value lines. Preserves comments and unrelated lines."""
    lines_out: list[str] = []
    keys_written: set[str] = set()
    keys_remove = {k for k, v in updates.items() if v is None}

    if path.is_file():
        for raw in path.read_text(encoding="utf-8", errors="replace").splitlines():
            stripped = raw.strip()
            if not stripped or stripped.startswith("#"):
                lines_out.append(raw)
                continue
            if "=" not in stripped:
                lines_out.append(raw)
                continue
            k, _, _ = stripped.partition("=")
            k = k.strip()
            if k in keys_remove:
                continue
            if k in updates and updates[k] is not None:
                lines_out.append(f"{k}={updates[k]}")
                keys_written.add(k)
                continue
            lines_out.append(raw)

    for k, v in updates.items():
        if v is None or k in keys_written:
            continue
        lines_out.append(f"{k}={v}")
        keys_written.add(k)

    path.write_text("\n".join(lines_out).rstrip() + "\n", encoding="utf-8")


def _drain_updates(token: str) -> int:
    """Return next offset after draining pending updates."""
    offset = 0
    while True:
        data = tg_api(token, "getUpdates", offset=offset, timeout=0)
        if not data.get("ok"):
            break
        results = data.get("result") or []
        if not results:
            break
        offset = results[-1]["update_id"] + 1
    return offset


def listen_for_user_ids(token: str, seconds: float = 90.0) -> set[int]:
    me = tg_api(token, "getMe")
    if not me.get("ok"):
        print("Could not reach Telegram (getMe failed).", file=sys.stderr)
        return set()
    un = me.get("result", {}).get("username", "?")
    print(f"\nOpen https://t.me/{un} in Telegram and send any message (e.g. /start),")
    print("  or post in your group if the bot is a member — user ids are collected from senders.")
    print(f"Listening for up to {int(seconds)} seconds… (Ctrl+C to stop)\n")
    offset = _drain_updates(token)
    found: set[int] = set()
    deadline = time.time() + seconds
    try:
        while time.time() < deadline:
            wait = min(25, max(1, int(deadline - time.time())))
            data = tg_api(token, "getUpdates", offset=offset, timeout=wait)
            if not data.get("ok"):
                time.sleep(2)
                continue
            for upd in data.get("result") or []:
                offset = upd["update_id"] + 1
                msg = upd.get("message") or upd.get("edited_message") or {}
                cq = upd.get("callback_query") or {}
                user = msg.get("from") or cq.get("from") or {}
                uid = user.get("id")
                if uid is not None:
                    i = int(uid)
                    if i not in found:
                        name = user.get("username") or user.get("first_name") or i
                        print(f"  • user id {i} ({name})")
                    found.add(i)
    except KeyboardInterrupt:
        print("\n(stopped listening)")
    return found


def _prompt_yes(prompt: str, default_no: bool = True) -> bool:
    suf = " [y/N]: " if default_no else " [Y/n]: "
    raw = input(prompt + suf).strip().lower()
    if not raw:
        return not default_no
    return raw in ("y", "yes", "1", "true")


def _whatsapp_env_value(merged: dict[str, str], key: str) -> str:
    return os.environ.get(key, "").strip() or merged.get(key, "").strip()


def whatsapp_inbound_ready(merged: dict[str, str] | None = None) -> bool:
    """True when pocket_cursor would start the WhatsApp webhook thread."""
    m = merged if merged is not None else _merged_env_files()
    en = _whatsapp_env_value(m, "WHATSAPP_CLOUD_ENABLED").lower()
    if en not in ("1", "true", "yes", "on"):
        return False
    for key in (
        "WHATSAPP_WEBHOOK_APP_SECRET",
        "WHATSAPP_VERIFY_TOKEN",
        "WHATSAPP_ALLOWED_FROM",
    ):
        if not _whatsapp_env_value(m, key):
            return False
    return True


def print_whatsapp_quick_path() -> None:
    print(
        "\n── WhatsApp (optional) — get keys from Meta ──\n"
        "  • Create / open app: https://developers.facebook.com/apps\n"
        "  • Add product “WhatsApp”, then use WhatsApp → API setup in the dashboard.\n"
        "  • App secret: App settings → Basic → App secret (click Show).\n"
        "  • Webhook needs HTTPS — tunnel default port 8792, path /webhook (e.g. ngrok http 8792).\n"
        "  • Full checklist: WHATSAPP.md in this folder (same directory as bridge_wizard.py).\n"
        "  • Guided .env:  ./scripts/pocket-cursor-bridge.sh --whatsapp   (from repo root)\n"
    )


def offer_whatsapp_setup_if_needed() -> None:
    merged = _merged_env_files()
    if whatsapp_inbound_ready(merged):
        print(
            "WhatsApp inbound: already configured (WHATSAPP_* in env or .env). "
            "Restart the bridge after edits.\n"
        )
        return
    print_whatsapp_quick_path()
    if _prompt_yes("Write WhatsApp Cloud variables to .env now (interactive)?", default_no=True):
        if run_whatsapp_env_wizard():
            print(
                "\nDone. Start an HTTPS tunnel to the port above, set Meta’s webhook URL to "
                "https://<public-host>/webhook with the same verify token, then restart the bridge.\n"
            )
    else:
        print("(Skipped — run later:  ./scripts/pocket-cursor-bridge.sh --whatsapp )\n")


def run_whatsapp_env_wizard() -> bool:
    """Prompt for Meta secrets and write WHATSAPP_* keys to .env."""
    print("\n── WhatsApp Cloud — write .env ──\n")
    guide = BRIDGE / "WHATSAPP.md"
    if guide.is_file():
        print(f"Reference: {guide}\n")

    app_secret = getpass.getpass(
        "WHATSAPP_WEBHOOK_APP_SECRET (Meta → App settings → Basic → App secret): "
    ).strip()
    if not app_secret:
        print("App secret is required.", file=sys.stderr)
        return False

    verify = secrets.token_urlsafe(20)
    print(
        "\nWHATSAPP_VERIFY_TOKEN (auto-generated — copy this into Meta → WhatsApp → Configuration → Webhook):\n"
        f"  {verify}\n"
    )

    raw_phones = input(
        "WHATSAPP_ALLOWED_FROM — your WhatsApp number(s), digits only, comma-separated (e.g. 491701234567): "
    ).strip()
    allowed: list[str] = []
    for part in raw_phones.split(","):
        digits = "".join(c for c in part if c.isdigit())
        if digits:
            allowed.append(digits)
    if not allowed:
        print("Need at least one phone number (digits only).", file=sys.stderr)
        return False
    allowed_csv = ",".join(allowed)

    port = input("WHATSAPP_WEBHOOK_PORT [8792]: ").strip() or "8792"
    bind = input("WHATSAPP_WEBHOOK_BIND [127.0.0.1]: ").strip() or "127.0.0.1"

    tok = input(
        "WHATSAPP_CLOUD_ACCESS_TOKEN (optional — WhatsApp → API setup; for outbound API only, not required for inbound): "
    ).strip()
    phone_id = input(
        "WHATSAPP_CLOUD_PHONE_NUMBER_ID (optional — same screen as token; for outbound only): "
    ).strip()

    updates: dict[str, str | None] = {
        "WHATSAPP_CLOUD_ENABLED": "1",
        "WHATSAPP_WEBHOOK_APP_SECRET": app_secret,
        "WHATSAPP_VERIFY_TOKEN": verify,
        "WHATSAPP_ALLOWED_FROM": allowed_csv,
        "WHATSAPP_WEBHOOK_PORT": port,
        "WHATSAPP_WEBHOOK_BIND": bind,
        "WHATSAPP_CLOUD_ACCESS_TOKEN": tok or None,
        "WHATSAPP_CLOUD_PHONE_NUMBER_ID": phone_id or None,
    }
    env_path = BRIDGE / ".env"
    upsert_env_file(env_path, updates)
    print(f"\nWrote WhatsApp keys to {env_path}\n")
    return True


def run_wizard(*, reconfigure: bool) -> bool:
    print("\n── PocketCursor — Telegram setup ──\n")
    token = ""
    existing = effective_telegram_token()

    if reconfigure and existing:
        print("Keep your existing bot token, or replace it with a new one from @BotFather.\n")
        if not _prompt_yes("Keep the current bot token?", default_no=False):
            token = getpass.getpass("New Telegram bot token: ").strip()
            if not token:
                print("No token entered.", file=sys.stderr)
                return False
        else:
            token = existing
    else:
        print("Create a bot with @BotFather if you do not have one yet, then paste the token.\n")
        token = getpass.getpass("Telegram bot token: ").strip()
        if not token:
            print("No token entered.", file=sys.stderr)
            return False

    ok, info = validate_token(token)
    if not ok:
        print(f"Invalid token: {info}", file=sys.stderr)
        return False
    print(f"OK — connected as @{info}\n")

    print("── Where should the bridge talk? ──")
    print(
        "  1) Direct messages — chat id is chosen from incoming messages (or an existing DM pin).\n"
        "  2) Fixed group / supergroup — pin a negative chat id so the bridge uses that group.\n"
    )
    mode = input("Choice [1]: ").strip() or "1"
    chat_id_path = BRIDGE / ".chat_id"
    cur_chat = read_chat_id_file()

    if mode.strip() == "2":
        raw = input(
            "Telegram group/supergroup chat id (e.g. -1001234567890; get it from @RawDataBot or similar):\n> "
        ).strip()
        if not raw or not raw.lstrip("-").isdigit():
            print("Invalid chat id (expected an integer, groups are usually negative).", file=sys.stderr)
            return False
        gid = int(raw)
        try:
            chat_id_path.write_text(str(gid), encoding="utf-8")
        except OSError as e:
            print(f"Could not write .chat_id: {e}", file=sys.stderr)
            return False
        print(f"\nPinned {chat_id_path.name} = {gid} (restart the bridge to apply if it is running.)")
        print(
            "Tip: In @BotFather → Bot Settings → Group Privacy → turn OFF so the bot receives "
            "all group messages (otherwise only /commands and @mentions reach the bot).\n"
        )
    else:
        if cur_chat is not None:
            if cur_chat < 0:
                q = "Remove pinned group chat id and go back to DMs / next message?"
            else:
                q = "Remove pinned chat id so the next message picks the chat again?"
            if _prompt_yes(q, default_no=True):
                try:
                    chat_id_path.unlink()
                except OSError:
                    pass
                print("Removed .chat_id.\n")
            else:
                print(f"Leaving .chat_id as {cur_chat}.\n")
        else:
            print("(No .chat_id file — incoming messages will bind the chat as before.)\n")

    allow: set[int] = set()
    line = input(
        "Allowed Telegram user ids (comma-separated), or Enter to skip:\n"
        "  (skip = first sender to the bot auto-pairs; in a group, set ids explicitly)\n> "
    ).strip()
    if line:
        for part in line.split(","):
            part = part.strip()
            if part.isdigit():
                allow.add(int(part))

    if _prompt_yes("Discover user ids by waiting for a Telegram message now?", default_no=True):
        discovered = listen_for_user_ids(token, seconds=90.0)
        allow |= discovered

    updates: dict[str, str | None] = {"TELEGRAM_BOT_TOKEN": token}
    if allow:
        updates["TELEGRAM_ALLOWED_USER_IDS"] = ",".join(str(x) for x in sorted(allow))
        updates["TELEGRAM_OWNER_ID"] = None
        print(f"\nAllowlist saved in .env: {sorted(allow)}")
        print("(Removed TELEGRAM_OWNER_ID from .env if it was there — admin-sync may still set it.)\n")
    else:
        updates["TELEGRAM_ALLOWED_USER_IDS"] = None
        print("\nNo allowlist in .env — first sender will auto-pair (see pocket_cursor.py).")

    env_path = BRIDGE / ".env"
    upsert_env_file(env_path, updates)
    print(f"\nWrote {env_path}\n")
    return True


def main() -> int:
    parser = argparse.ArgumentParser(description="PocketCursor Telegram setup wizard")
    parser.add_argument(
        "--ensure",
        action="store_true",
        help="Used by pocket-cursor-bridge.sh: first-time setup, or prompt to reconfigure if already set",
    )
    parser.add_argument(
        "--whatsapp",
        action="store_true",
        help="WhatsApp Cloud only: print Meta key locations and optionally write WHATSAPP_* to .env",
    )
    args = parser.parse_args()

    if args.whatsapp:
        print_whatsapp_quick_path()
        if not _prompt_yes("Write WhatsApp variables to .env now?", default_no=True):
            return 0
        return 0 if run_whatsapp_env_wizard() else 1

    tok = effective_telegram_token()
    if tok:
        print_config_summary()
        if not _prompt_yes(
            "Reconfigure Telegram bridge settings (token, chat, allowlist)?",
            default_no=True,
        ):
            offer_whatsapp_setup_if_needed()
            return 0
        ok = run_wizard(reconfigure=True)
        if ok:
            offer_whatsapp_setup_if_needed()
        return 0 if ok and effective_telegram_token() else 1

    ok = run_wizard(reconfigure=False)
    if ok and effective_telegram_token():
        offer_whatsapp_setup_if_needed()
    return 0 if ok and effective_telegram_token() else 1


if __name__ == "__main__":
    raise SystemExit(main())
