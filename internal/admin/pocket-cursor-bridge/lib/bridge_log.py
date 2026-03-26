"""
Centralized logging for the PocketCursor Telegram bridge.

- Rotating text log: logs/pocket-bridge.log (every line mirrors console [HH:MM:SS.mmm] output)
- Optional JSON lines: logs/pocket-bridge-events.jsonl (structured events)

Use init_bridge_logging() once at startup, then wrap_ts_print() around chat_detection.ts_print.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

_bridge_dir: Path | None = None
_file_logger: logging.Logger | None = None
_events_path: Path | None = None
_lock = threading.Lock()


def bridge_dir() -> Path:
    if _bridge_dir is None:
        raise RuntimeError("bridge_log.init_bridge_logging() not called")
    return _bridge_dir


def log_file_path() -> Path:
    return bridge_dir() / "logs" / "pocket-bridge.log"


def events_file_path() -> Path:
    return bridge_dir() / "logs" / "pocket-bridge-events.jsonl"


def init_bridge_logging(bridge_dir: Path) -> None:
    """Create logs/, rotating file handler, and (re)bind module state. Safe to call once."""
    global _bridge_dir, _file_logger, _events_path
    with _lock:
        _bridge_dir = bridge_dir.resolve()
        logs = _bridge_dir / "logs"
        logs.mkdir(parents=True, exist_ok=True)
        _events_path = logs / "pocket-bridge-events.jsonl"

        _file_logger = logging.getLogger("pocket.bridge.file")
        _file_logger.setLevel(logging.DEBUG)
        _file_logger.handlers.clear()
        _file_logger.propagate = False

        path = logs / "pocket-bridge.log"
        handler = logging.handlers.RotatingFileHandler(
            path,
            maxBytes=5 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        handler.setFormatter(logging.Formatter("%(message)s"))
        _file_logger.addHandler(handler)


def wrap_ts_print(inner: Callable[..., None]) -> Callable[..., None]:
    """Mirror every ts_print line to pocket-bridge.log (same text as console)."""

    def wrapped(*args, **kwargs) -> None:
        inner(*args, **kwargs)
        if _file_logger is None:
            return
        ts = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        line = f"[{ts}] " + " ".join(str(a) for a in args)
        try:
            _file_logger.info(line)
        except Exception:
            pass

    return wrapped


def log_event(event: str, **fields: Any) -> None:
    """Append one JSON line to pocket-bridge-events.jsonl (best-effort)."""
    if _events_path is None:
        return
    row = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
        "event": event,
        **fields,
    }
    line = json.dumps(row, ensure_ascii=False, default=str) + "\n"
    try:
        with _lock:
            with open(_events_path, "a", encoding="utf-8") as f:
                f.write(line)
    except Exception:
        pass


def tail_log_lines(max_lines: int = 100, max_chars: int = 3500) -> str:
    """Return the tail of pocket-bridge.log for Telegram (stay under ~4k chars)."""
    path = log_file_path()
    if not path.is_file():
        return "No log file yet. Start the bridge once; logs go to:\n" + str(path)
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return f"Could not read log: {e}"
    lines = raw.splitlines()
    chunk = lines[-max_lines:]
    body = "\n".join(chunk)
    while len(body) > max_chars and len(chunk) > 1:
        chunk = chunk[1:]
        body = "\n".join(chunk)
    if not body.strip():
        return "(log file empty)"
    header = f"… last {len(chunk)} lines · {path}\n\n"
    return header + body


def tail_events_jsonl(max_lines: int = 40, max_chars: int = 3200) -> str:
    """Last N JSON lines from events file (human-readable for Telegram)."""
    path = events_file_path()
    if not path.is_file():
        return "No structured events yet."
    try:
        raw = path.read_text(encoding="utf-8", errors="replace")
    except OSError as e:
        return f"Could not read events: {e}"
    lines = [ln for ln in raw.splitlines() if ln.strip()]
    picked = lines[-max_lines:]
    text = "\n".join(picked)
    if len(text) > max_chars:
        text = "…\n" + text[-max_chars:]
    return f"Structured events · {path}\n\n{text}"
