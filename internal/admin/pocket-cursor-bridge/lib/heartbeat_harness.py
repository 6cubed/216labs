# -*- coding: utf-8 -*-
"""
Periodic Cursor prompts ("heartbeat") — config and enablement.

Harness text and timing live in lib/heartbeat_harness.json (hot-reloaded).
Enablement is persisted in .heartbeat_enabled beside pocket_cursor.py;
POCKET_HEARTBEAT_ENABLED=1|0 syncs that file on bridge startup.
"""
from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from pathlib import Path

_HARNESS_FILE = Path(__file__).parent / "heartbeat_harness.json"
_harness_mtime = 0.0
_harness: dict = {}

DEFAULT_MESSAGE = (
    "Drive the stack forward: fix what's broken, advance active projects, "
    "and improve things that matter—even ideas outside the current thread "
    "if they're clearly high leverage."
)
DEFAULT_EXECUTION_FLOOR = (
    "Ship something real this cycle—fix, feature, refactor, commit, push, deploy, "
    "or a doc that unlocks the next step. Status-only replies don't count. "
    "When blocked, name the blocker and the next concrete move."
)
DEFAULT_INTERVAL_SEC = 1800
DEFAULT_FIRST_RUN_DELAY_SEC = 120
MIN_INTERVAL_SEC = 300
MAX_INTERVAL_SEC = 86_400
MAX_FIRST_RUN_DELAY_SEC = 1800

_DEFAULT_REFLECT_PROMPTS = [
    "Reflect: what is the highest-leverage unfinished item right now, and what blocks it?",
    "Prioritize: name your top three outcomes for the next 30 minutes—pick the boldest one you can still land and start.",
    "Ideate: what change would compound across projects this week if you shipped it now?",
    "Execute: land a meaningful slice—bugfix, feature, infra, or polish—not a planning monologue.",
    "Reflect: what did the last heartbeat accomplish? If it was mostly status, what will you change in the repo this time?",
    "Prioritize: scan git status, open issues, and Telegram threads—move the needle that matters most.",
    "Ideate: what would a user notice if you shipped in the next ten minutes?",
    "Execute: finish and commit (or deploy) the best shippable unit of work you can see—don't sand down scope until it's trivial.",
    "Reflect: which assumptions from earlier today still hold? What changed?",
    "Prioritize: what is stale (docs, manifest, deploy, monitoring) versus the code on disk—close the gap.",
    "Ideate: what half-finished thread from Telegram or this chat deserves a decisive close-out?",
    "Execute: advance a project with a real diff; pairing a small fix with a slightly bolder improvement is welcome.",
    "Reflect: where are you playing it safe? Pick the harder honest move and act.",
    "Prioritize: if you could only ship one thing before the next heartbeat, what would move the product most?",
    "Ideate: what outside-the-box improvement (DX, observability, UX, automation) is worth a bet this cycle?",
    "Execute: try one improvement you haven't been asked for—if it's clearly good for the monorepo, ship it.",
    "Reflect: what would you regret leaving uncommitted overnight?",
    "Ideate: what's one experiment you could run in-repo in under 30 minutes that might pay off all week?",
]

_bridge_dir: Path | None = None
_enabled_file: Path | None = None


def init(bridge_dir: Path) -> None:
    global _bridge_dir, _enabled_file
    _bridge_dir = bridge_dir.resolve()
    _enabled_file = _bridge_dir / ".heartbeat_enabled"
    _reload_harness(force=True)


def apply_env_on_startup() -> None:
    """Sync .heartbeat_enabled from POCKET_HEARTBEAT_ENABLED when set."""
    if _enabled_file is None:
        return
    raw = os.environ.get("POCKET_HEARTBEAT_ENABLED", "").strip().lower()
    if raw in ("1", "true", "yes", "on"):
        _enabled_file.touch()
    elif raw in ("0", "false", "no", "off"):
        _enabled_file.unlink(missing_ok=True)


def is_enabled() -> bool:
    return bool(_enabled_file and _enabled_file.exists())


def set_enabled(on: bool) -> None:
    if _enabled_file is None:
        return
    if on:
        _enabled_file.touch()
    else:
        _enabled_file.unlink(missing_ok=True)


def _reload_harness(force: bool = False) -> None:
    global _harness, _harness_mtime
    if not _HARNESS_FILE.is_file():
        _harness = {}
        _harness_mtime = 0.0
        return
    try:
        mt = _HARNESS_FILE.stat().st_mtime
        if not force and mt == _harness_mtime:
            return
        data = json.loads(_HARNESS_FILE.read_text(encoding="utf-8"))
        _harness = data if isinstance(data, dict) else {}
        _harness_mtime = mt
    except Exception as e:
        print(f"[heartbeat] Failed to load harness: {e}")


def _truthy(val, default: bool = True) -> bool:
    if val is None:
        return default
    if isinstance(val, bool):
        return val
    if isinstance(val, str):
        return val.lower() in ("1", "true", "yes", "on")
    return bool(val)


def _reflect_prompts() -> list[str]:
    raw = _harness.get("reflect_prompts")
    if isinstance(raw, list):
        out = [str(p).strip() for p in raw if isinstance(p, str) and str(p).strip()]
        if out:
            return out
    return list(_DEFAULT_REFLECT_PROMPTS)


def _reflect_enabled() -> bool:
    env = os.environ.get("POCKET_HEARTBEAT_REFLECT", "").strip().lower()
    if env in ("0", "false", "no", "off"):
        return False
    if env in ("1", "true", "yes", "on"):
        return True
    return _truthy(_harness.get("reflect_enabled"), True)


def _execution_floor() -> str:
    env = os.environ.get("POCKET_HEARTBEAT_EXECUTION_FLOOR", "").strip()
    if env:
        return env
    raw = _harness.get("execution_floor")
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return DEFAULT_EXECUTION_FLOOR


def pick_reflect_prompt() -> str:
    """Random critical-thinking nudge (reflect / prioritize / ideate / execute)."""
    return random.choice(_reflect_prompts())


def compose_message(base: str | None = None) -> tuple[str, str]:
    """Build full heartbeat text. Returns (full_message, reflect_line_or_empty)."""
    _reload_harness()
    if base is None:
        base = get_config().message
    reflect_line = ""
    parts = [base.strip()]
    if _reflect_enabled():
        reflect_line = pick_reflect_prompt()
        parts.append(f"\n\n[Reflect] {reflect_line}")
    parts.append(f"\n\n[Push] {_execution_floor()}")
    return "".join(parts), reflect_line


@dataclass(frozen=True)
class HeartbeatConfig:
    message: str
    interval_sec: int
    first_run_delay_sec: int
    skip_when_generating: bool
    notify_telegram: bool
    reflect_enabled: bool


def get_config() -> HeartbeatConfig:
    _reload_harness()
    env_interval = os.environ.get("POCKET_HEARTBEAT_INTERVAL_SEC", "").strip()
    interval = DEFAULT_INTERVAL_SEC
    if env_interval.isdigit():
        interval = int(env_interval)
    elif isinstance(_harness.get("interval_sec"), (int, float)):
        interval = int(_harness["interval_sec"])
    interval = max(MIN_INTERVAL_SEC, min(MAX_INTERVAL_SEC, interval))

    env_msg = os.environ.get("POCKET_HEARTBEAT_MESSAGE", "").strip()
    if env_msg:
        message = env_msg
    else:
        raw = _harness.get("message")
        message = raw.strip() if isinstance(raw, str) and raw.strip() else DEFAULT_MESSAGE

    skip = _truthy(_harness.get("skip_when_generating"), True)
    notify = _truthy(_harness.get("notify_telegram"), True)

    env_first = os.environ.get("POCKET_HEARTBEAT_FIRST_DELAY_SEC", "").strip()
    first_delay = DEFAULT_FIRST_RUN_DELAY_SEC
    if env_first.isdigit():
        first_delay = int(env_first)
    elif isinstance(_harness.get("first_run_delay_sec"), (int, float)):
        first_delay = int(_harness["first_run_delay_sec"])
    first_delay = max(0, min(MAX_FIRST_RUN_DELAY_SEC, first_delay))

    return HeartbeatConfig(
        message=message,
        interval_sec=interval,
        first_run_delay_sec=first_delay,
        skip_when_generating=skip,
        notify_telegram=notify,
        reflect_enabled=_reflect_enabled(),
    )


def status_summary() -> str:
    cfg = get_config()
    mins = cfg.interval_sec // 60
    interval_label = f"{mins} min" if cfg.interval_sec % 60 == 0 else f"{cfg.interval_sec}s"
    n_reflect = len(_reflect_prompts())
    lines = [
        f"Heartbeat: {'ON' if is_enabled() else 'OFF'}",
        f"Interval: every {interval_label} (first run {cfg.first_run_delay_sec}s after bridge start)",
        f"Skip while generating: {'yes' if cfg.skip_when_generating else 'no'}",
        f"Telegram ping on send: {'yes' if cfg.notify_telegram else 'no'}",
        f"Reflect prompts: {'ON' if cfg.reflect_enabled else 'OFF'} ({n_reflect} in pool, random each beat)",
        f"Base prompt: {cfg.message[:120]}{'…' if len(cfg.message) > 120 else ''}",
        "Edit lib/heartbeat_harness.json to change prompts/interval (hot-reload).",
        "Use /heartbeat on, /heartbeat off, or /heartbeat now",
    ]
    return "\n".join(lines)
