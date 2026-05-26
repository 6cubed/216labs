# -*- coding: utf-8 -*-
"""
Agitweet "heartbeat" — periodically post a short thought to our social app.

Config lives in lib/agitweet_harness.json (hot-reloaded).
Enablement is persisted in .agitweet_enabled beside pocket_cursor.py;
POCKET_AGITWEET_ENABLED=1|0 syncs that file on bridge startup.
"""

from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from pathlib import Path

_HARNESS_FILE = Path(__file__).parent / "agitweet_harness.json"
_harness_mtime = 0.0
_harness: dict = {}

DEFAULT_INTERVAL_SEC = 900
DEFAULT_FIRST_RUN_DELAY_SEC = 90
MIN_INTERVAL_SEC = 60
MAX_INTERVAL_SEC = 86_400
MAX_FIRST_RUN_DELAY_SEC = 1800

_DEFAULT_PROMPTS = [
    "216labs: ship small, compound relentlessly.",
    "AGI is a substrate shift; incentives decide the shape.",
    "The infinite internet arrives as infinite refinement.",
]

_bridge_dir: Path | None = None
_enabled_file: Path | None = None


def init(bridge_dir: Path) -> None:
    global _bridge_dir, _enabled_file
    _bridge_dir = bridge_dir.resolve()
    _enabled_file = _bridge_dir / ".agitweet_enabled"
    _reload_harness(force=True)


def apply_env_on_startup() -> None:
    """Sync .agitweet_enabled from POCKET_AGITWEET_ENABLED when set."""
    if _enabled_file is None:
        return
    raw = os.environ.get("POCKET_AGITWEET_ENABLED", "").strip().lower()
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
        print(f"[agitweet] Failed to load harness: {e}")


def _max_len() -> int:
    raw = _harness.get("max_len")
    if isinstance(raw, (int, float)):
        return max(80, min(500, int(raw)))
    return 260


def _prompt_pool() -> list[str]:
    raw = _harness.get("prompt_pool")
    if isinstance(raw, list):
        out = [str(p).strip() for p in raw if isinstance(p, str) and str(p).strip()]
        if out:
            return out
    return list(_DEFAULT_PROMPTS)


def _clamp_interval(x: int) -> int:
    return max(MIN_INTERVAL_SEC, min(MAX_INTERVAL_SEC, int(x)))


@dataclass(frozen=True)
class AgitweetConfig:
    interval_sec: int
    first_run_delay_sec: int
    max_len: int


def get_config() -> AgitweetConfig:
    _reload_harness()
    interval = DEFAULT_INTERVAL_SEC
    env_interval = os.environ.get("POCKET_AGITWEET_INTERVAL_SEC", "").strip()
    if env_interval.isdigit():
        interval = int(env_interval)
    elif isinstance(_harness.get("interval_sec"), (int, float)):
        interval = int(_harness["interval_sec"])

    first_delay = DEFAULT_FIRST_RUN_DELAY_SEC
    env_first = os.environ.get("POCKET_AGITWEET_FIRST_DELAY_SEC", "").strip()
    if env_first.isdigit():
        first_delay = int(env_first)
    elif isinstance(_harness.get("first_run_delay_sec"), (int, float)):
        first_delay = int(_harness["first_run_delay_sec"])
    first_delay = max(0, min(MAX_FIRST_RUN_DELAY_SEC, int(first_delay)))

    return AgitweetConfig(
        interval_sec=_clamp_interval(interval),
        first_run_delay_sec=first_delay,
        max_len=_max_len(),
    )


def compose_post() -> str:
    _reload_harness()
    text = random.choice(_prompt_pool()).strip()
    ml = _max_len()
    if len(text) <= ml:
        return text
    # Hard cut with ellipsis; avoid mid-surrogate issues (Python str is unicode-safe).
    return text[: max(0, ml - 1)].rstrip() + "…"


def status_summary() -> str:
    cfg = get_config()
    mins = cfg.interval_sec // 60
    interval_label = f"{mins} min" if cfg.interval_sec % 60 == 0 else f"{cfg.interval_sec}s"
    n_prompts = len(_prompt_pool())
    return "\n".join(
        [
            f"Agitweet: {'ON' if is_enabled() else 'OFF'}",
            f"Interval: every {interval_label} (first run {cfg.first_run_delay_sec}s after bridge start)",
            f"Max post length: {cfg.max_len}",
            f"Prompt pool: {n_prompts} items (random each post)",
            "Edit lib/agitweet_harness.json to change prompts/interval (hot-reload).",
            "Use /agitweet on, /agitweet off, /agitweet now, or /agitweet status",
        ]
    )

