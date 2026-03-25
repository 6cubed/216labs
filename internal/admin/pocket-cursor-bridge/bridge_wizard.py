#!/usr/bin/env python3
"""
Interactive Telegram setup for PocketCursor. Used by scripts/pocket-cursor-bridge.sh when
no bot token is available from the environment or merged .env files.

Precedence matches pocket_cursor.py: process env wins; then .env.admin-sync; then .env.
"""
from __future__ import annotations

import argparse
import getpass
import os
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


def effective_telegram_token() -> str:
    merged: dict[str, str] = {}
    merged.update(_parse_env_file(BRIDGE / ".env.admin-sync"))
    merged.update(_parse_env_file(BRIDGE / ".env"))
    t = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    if t:
        return t
    return merged.get("TELEGRAM_BOT_TOKEN", "").strip()


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
    print(f"\nOpen https://t.me/{un} in Telegram and send any message (e.g. /start).")
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


def run_wizard() -> bool:
    print("\n── PocketCursor — Telegram setup ──\n")
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

    allow: set[int] = set()
    line = input(
        "Allowed Telegram user ids (comma-separated), or Enter to skip:\n"
        "  (skip = first person to message the bot is paired automatically)\n> "
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
        print(f"\nAllowlist saved: {sorted(allow)}")
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
        help="Exit 0 if token already configured; else run wizard",
    )
    args = parser.parse_args()

    force = os.environ.get("POCKET_WIZARD", "").strip().lower() in ("1", "true", "yes", "on")

    if args.ensure:
        tok = effective_telegram_token()
        if tok and not force:
            return 0
        if tok and force:
            if not _prompt_yes("Replace existing Telegram bridge configuration?", default_no=True):
                return 0
        ok = run_wizard()
        return 0 if ok and effective_telegram_token() else 1

    ok = run_wizard()
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
