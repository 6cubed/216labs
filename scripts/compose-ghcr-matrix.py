#!/usr/bin/env python3
"""Emit GitHub Actions matrix `include` JSON for GHCR image builds.

Reads `docker compose config --format json` output (file path or stdin).
Each matrix row has: service, image, and optional platform (e.g. cron-runner -> linux/amd64).
"""
from __future__ import annotations

import json
import sys


def main() -> None:
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            cfg = json.load(f)
    else:
        cfg = json.load(sys.stdin)

    services = cfg.get("services", {})
    include: list[dict[str, str]] = []
    for name in sorted(services.keys()):
        if name == "caddy":
            continue
        svc = services[name]
        if "build" not in svc:
            continue
        img = svc.get("image", "")
        if not img.startswith("216labs/"):
            continue
        row: dict[str, str] = {"service": name, "image": img, "platform": ""}
        if name == "cron-runner":
            row["platform"] = "linux/amd64"
        include.append(row)

    print(json.dumps(include))


if __name__ == "__main__":
    main()
