#!/usr/bin/env python3
"""Emit GitHub Actions matrix `include` JSON for GHCR image builds.

Reads `docker compose config --format json` output (file path or stdin).
Each matrix row has: service, image, and optional platform (e.g. cron-runner -> linux/amd64).

Services in SKIP_GHCR_SERVICES are omitted: they need a larger runner, manual publish,
or a follow-up fix (e.g. Flutter web without pubspec.lock).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import sys

# Omit from CI matrix — publish via ./deploy.sh or workflow_dispatch on a beefy runner.
SKIP_GHCR_SERVICES = frozenset(
    {s.strip().lower() for s in os.environ.get("GHCR_SKIP_SERVICES", "anchor-web").split(",") if s.strip()}
)


def _norm_repo_path(path: str) -> str:
    p = path.replace("\\", "/").strip()
    if not p:
        return ""
    p = p.lstrip("./")
    while "//" in p:
        p = p.replace("//", "/")
    return p


def _changed_files_from_env() -> set[str]:
    raw = os.environ.get("GHCR_CHANGED_FILES", "").strip()
    if not raw:
        return set()
    return {_norm_repo_path(line) for line in raw.splitlines() if _norm_repo_path(line)}


def _service_paths(name: str, svc: dict) -> tuple[str, str]:
    build = svc.get("build")
    if isinstance(build, str):
        context = _norm_repo_path(build)
        dockerfile = _norm_repo_path(f"{context}/Dockerfile")
        return context, dockerfile
    if isinstance(build, dict):
        context = _norm_repo_path(str(build.get("context", ".")))
        dockerfile_raw = str(build.get("dockerfile", "Dockerfile"))
        dockerfile_path = Path(dockerfile_raw)
        if dockerfile_path.is_absolute():
            dockerfile = _norm_repo_path(dockerfile_raw)
        else:
            dockerfile = _norm_repo_path(f"{context}/{dockerfile_raw}")
        return context, dockerfile
    # Non-build services are filtered earlier; keep safe defaults.
    return "", ""


def _service_changed(name: str, svc: dict, changed_files: set[str]) -> bool:
    if not changed_files:
        return True

    # Infra/workflow changes can alter all image build behavior.
    if any(
        f in {"docker-compose.yml", "scripts/compose-ghcr-matrix.py", ".github/workflows/ghcr-publish.yml"}
        for f in changed_files
    ):
        return True
    # Shared Python copied into multiple image build contexts (e.g. labs_http).
    if any(f.startswith("internal/python/") for f in changed_files):
        return True

    context, dockerfile = _service_paths(name, svc)
    if dockerfile and dockerfile in changed_files:
        return True
    if context and any(f == context or f.startswith(f"{context}/") for f in changed_files):
        return True
    return False


def main() -> None:
    if len(sys.argv) > 1:
        with open(sys.argv[1], encoding="utf-8") as f:
            cfg = json.load(f)
    else:
        cfg = json.load(sys.stdin)

    services = cfg.get("services", {})
    changed_files = _changed_files_from_env()
    include: list[dict[str, str]] = []
    for name in sorted(services.keys()):
        if name == "caddy":
            continue
        if name.lower() in SKIP_GHCR_SERVICES:
            continue
        svc = services[name]
        if "build" not in svc:
            continue
        if not _service_changed(name, svc, changed_files):
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
