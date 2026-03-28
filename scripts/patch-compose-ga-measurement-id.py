#!/usr/bin/env python3
"""Insert GA_MEASUREMENT_ID into docker-compose.yml service environment blocks (idempotent)."""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
PATH = REPO / "docker-compose.yml"

LINE = "      - GA_MEASUREMENT_ID=${GA_MEASUREMENT_ID:-}"

# Infra / edge — no public HTML worth tagging
EXCLUDE = frozenset(
    {
        "caddy",
        "activator",
        "cron-runner",
        "happypath",
        "caddy_data",
        "caddy_config",
    }
)


def main() -> None:
    text = PATH.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    in_services = False
    current: str | None = None
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("services:"):
            in_services = True
            current = None
            out.append(line)
            i += 1
            continue
        if in_services and (line.startswith("volumes:") or line.startswith("networks:")):
            in_services = False
            current = None
        m = re.match(r"^  ([a-z0-9_-]+):\s*$", line)
        if in_services and m:
            current = m.group(1)
        if (
            in_services
            and current
            and current not in EXCLUDE
            and line.strip() == "environment:"
        ):
            block = "".join(lines[i : min(i + 30, len(lines))])
            out.append(line)
            if "GA_MEASUREMENT_ID" not in block:
                out.append(LINE + "\n")
            i += 1
            continue
        out.append(line)
        i += 1
    PATH.write_text("".join(out), encoding="utf-8")
    print("updated", PATH.relative_to(REPO))


if __name__ == "__main__":
    main()
