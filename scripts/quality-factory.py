#!/usr/bin/env python3
"""Automated quality gates for thousands of apps.

Designed for scale:
- Changed-app gate on PR/push (cheap, blocks regressions early)
- Sharded all-app live sweeps on schedule (broad production coverage)

Checks:
1) manifest: schema/consistency checks
2) compose: app exists in docker-compose config
3) offline: build + boot container and probe HTTP
4) live: probe deployed app URL
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parent.parent
APP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*$")
DOCKER_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
SHARED_REBUILD_PATHS = {
    "docker-compose.yml",
    "Caddyfile",
    "scripts/generate-compose.py",
    "scripts/generate-caddyfile.py",
    "scripts/quality-factory.py",
}


@dataclass(frozen=True)
class AppManifest:
    app_id: str
    docker_service: str
    internal_port: int
    rel_dir: str
    abs_dir: Path
    build_context: str
    build_dockerfile: str
    health_path: str


def _run(cmd: list[str], *, cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        cmd,
        cwd=str(cwd or REPO_ROOT),
        text=True,
        capture_output=True,
        check=check,
    )


def _norm_rel(path: str) -> str:
    p = path.replace("\\", "/").strip()
    p = p.lstrip("./")
    while "//" in p:
        p = p.replace("//", "/")
    return p


def _manifest_dirs() -> Iterable[tuple[str, Path]]:
    top_skip = {".git", ".cursor", "node_modules", ".venv", "venv", "__pycache__"}
    for root in ("products", "internal"):
        base = REPO_ROOT / root
        if not base.is_dir():
            continue
        stack: list[tuple[Path, str]] = [(base, root)]
        while stack:
            abs_dir, rel = stack.pop()
            try:
                entries = list(abs_dir.iterdir())
            except OSError:
                continue
            if (abs_dir / "manifest.json").is_file():
                yield rel, abs_dir
                continue
            for entry in entries:
                if not entry.is_dir():
                    continue
                if entry.name.startswith(".") or entry.name in top_skip:
                    continue
                stack.append((entry, f"{rel}/{entry.name}"))


def discover_manifests() -> list[AppManifest]:
    out: list[AppManifest] = []
    for rel_dir, abs_dir in _manifest_dirs():
        mp = abs_dir / "manifest.json"
        try:
            data = json.loads(mp.read_text(encoding="utf-8"))
        except Exception as exc:
            raise RuntimeError(f"Invalid manifest JSON: {mp}: {exc}") from exc
        app_id = str(data.get("id", "")).strip()
        docker_service = str(data.get("docker_service", app_id)).strip() or app_id
        try:
            internal_port = int(data.get("internal_port", 3000))
        except Exception as exc:
            raise RuntimeError(f"{mp}: internal_port must be int") from exc
        build_context = _norm_rel(str(data.get("build_context", f"./{rel_dir}")))
        if not build_context:
            build_context = rel_dir
        build_dockerfile = str(data.get("build_dockerfile", "Dockerfile")).strip() or "Dockerfile"
        health_path = str(data.get("health_path", "/health")).strip() or "/health"
        if not health_path.startswith("/"):
            health_path = "/" + health_path
        out.append(
            AppManifest(
                app_id=app_id,
                docker_service=docker_service,
                internal_port=internal_port,
                rel_dir=rel_dir,
                abs_dir=abs_dir,
                build_context=build_context,
                build_dockerfile=build_dockerfile,
                health_path=health_path,
            )
        )
    return sorted(out, key=lambda a: a.app_id)


def validate_manifests(apps: list[AppManifest]) -> list[str]:
    errs: list[str] = []
    seen_ids: set[str] = set()
    for app in apps:
        if not app.app_id or not APP_ID_RE.match(app.app_id):
            errs.append(f"{app.rel_dir}: invalid app id '{app.app_id}'")
        if app.app_id in seen_ids:
            errs.append(f"{app.rel_dir}: duplicate app id '{app.app_id}'")
        seen_ids.add(app.app_id)
        if not DOCKER_NAME_RE.match(app.docker_service):
            errs.append(f"{app.rel_dir}: invalid docker_service '{app.docker_service}'")
        if app.internal_port <= 0 or app.internal_port > 65535:
            errs.append(f"{app.rel_dir}: invalid internal_port '{app.internal_port}'")
        ctx = REPO_ROOT / app.build_context
        if not ctx.exists():
            errs.append(f"{app.rel_dir}: build_context missing: {app.build_context}")
        df = ctx / app.build_dockerfile
        if not df.exists():
            errs.append(f"{app.rel_dir}: dockerfile missing: {app.build_context}/{app.build_dockerfile}")
    return errs


def load_compose_service_names() -> set[str]:
    compose_file = REPO_ROOT / "docker-compose.yml"
    if not compose_file.exists():
        raise RuntimeError("docker-compose.yml not found")
    text = compose_file.read_text(encoding="utf-8")
    in_services = False
    names: set[str] = set()
    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not in_services:
            if line.strip() == "services:":
                in_services = True
            continue
        if line and not line.startswith(" "):
            break
        # Service keys are two-space indented: `  foo:` or `  "1pager":`
        m = re.match(r'^\s{2}"?([a-zA-Z0-9_.-]+)"?:\s*$', line)
        if m:
            names.add(m.group(1))
    return names


def changed_files(base: str, head: str) -> set[str]:
    cp = _run(["git", "diff", "--name-only", base, head], check=True)
    return {_norm_rel(line) for line in cp.stdout.splitlines() if _norm_rel(line)}


def select_apps(
    apps: list[AppManifest],
    *,
    mode: str,
    changed: set[str],
    shard_index: int,
    shard_count: int,
    max_apps: int,
) -> list[AppManifest]:
    selected = apps
    if mode == "changed":
        if changed and any(p in SHARED_REBUILD_PATHS or p.startswith(".github/workflows/") for p in changed):
            selected = apps
        elif changed:
            selected = [
                a
                for a in apps
                if any(p == a.rel_dir or p.startswith(f"{a.rel_dir}/") for p in changed)
            ]
        else:
            selected = apps
    if shard_count > 1:
        selected = [
            a
            for a in selected
            if (int(hashlib.sha1(a.app_id.encode("utf-8")).hexdigest(), 16) % shard_count) == shard_index
        ]
    if max_apps > 0:
        selected = selected[:max_apps]
    return selected


def check_compose(selected: list[AppManifest], service_names: set[str]) -> list[str]:
    errs: list[str] = []
    for app in selected:
        if app.docker_service not in service_names:
            errs.append(f"{app.app_id}: docker service '{app.docker_service}' missing from compose config")
    return errs


def _http_probe(url: str, timeout_s: float) -> tuple[int | None, str]:
    req = urllib.request.Request(url, headers={"User-Agent": "quality-factory/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            body = resp.read(5000).decode("utf-8", errors="replace")
            return int(resp.getcode()), body
    except urllib.error.HTTPError as e:
        try:
            body = e.read(5000).decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return int(e.code), body
    except Exception as e:
        return None, str(e)


def check_live(selected: list[AppManifest], domain: str, timeout_s: float) -> list[str]:
    errs: list[str] = []
    for app in selected:
        url = f"https://{app.app_id}.{domain}"
        code, body = _http_probe(url, timeout_s)
        if code is None:
            errs.append(f"{app.app_id}: live probe failed ({body})")
            continue
        if code >= 500:
            errs.append(f"{app.app_id}: live probe returned {code}")
            continue
        lowered = body.lower()
        if "unknown app" in lowered and "not in admin db" in lowered:
            errs.append(f"{app.app_id}: live probe shows activator unknown-app page")
    return errs


def _docker_build_tag(app: AppManifest) -> str:
    return f"qf-{app.app_id}:ci"


def _docker_run_name(app: AppManifest) -> str:
    suffix = hashlib.sha1(app.app_id.encode("utf-8")).hexdigest()[:10]
    return f"qf-{app.app_id}-{suffix}"


def check_offline(selected: list[AppManifest], timeout_s: float, boot_wait_s: float) -> list[str]:
    errs: list[str] = []
    for app in selected:
        tag = _docker_build_tag(app)
        ctx = app.build_context
        dockerfile_path = str((REPO_ROOT / ctx / app.build_dockerfile).resolve())
        run_name = _docker_run_name(app)
        try:
            print(f"[offline] build {app.app_id}", flush=True)
            _run(
                ["docker", "build", "-t", tag, "-f", dockerfile_path, str((REPO_ROOT / ctx).resolve())],
                check=True,
            )
            _run(
                [
                    "docker",
                    "run",
                    "--rm",
                    "-d",
                    "--name",
                    run_name,
                    "-e",
                    f"PORT={app.internal_port}",
                    "-p",
                    f"127.0.0.1::{app.internal_port}",
                    tag,
                ],
                check=True,
            )
            time.sleep(boot_wait_s)
            port_cp = _run(["docker", "port", run_name, f"{app.internal_port}/tcp"], check=True)
            mapped = port_cp.stdout.strip()
            if not mapped or ":" not in mapped:
                errs.append(f"{app.app_id}: unable to read mapped port")
                continue
            host_port = mapped.rsplit(":", 1)[1]
            urls = [f"http://127.0.0.1:{host_port}{app.health_path}", f"http://127.0.0.1:{host_port}/", f"http://127.0.0.1:{host_port}/healthz"]
            ok = False
            for url in urls:
                code, body = _http_probe(url, timeout_s)
                if code is not None and code < 500:
                    ok = True
                    break
                if code is None and "Connection refused" in body:
                    time.sleep(0.6)
            if not ok:
                logs = _run(["docker", "logs", run_name], check=False).stdout[-2000:]
                errs.append(f"{app.app_id}: offline probe failed ({urls[0]}). logs tail:\n{logs}")
        except subprocess.CalledProcessError as e:
            snippet = (e.stderr or e.stdout or "").strip()[-2000:]
            errs.append(f"{app.app_id}: docker build/run failed: {snippet}")
        finally:
            _run(["docker", "rm", "-f", run_name], check=False)
    return errs


def parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Quality checks for app fleet")
    ap.add_argument("--mode", choices=["changed", "all"], default="changed")
    ap.add_argument("--base-ref", default="HEAD~1")
    ap.add_argument("--head-ref", default="HEAD")
    ap.add_argument("--checks", default="manifest,compose", help="Comma-separated: manifest,compose,offline,live")
    ap.add_argument("--domain", default="6cubed.app", help="Base domain for live checks")
    ap.add_argument("--shard-index", type=int, default=0)
    ap.add_argument("--shard-count", type=int, default=1)
    ap.add_argument("--max-apps", type=int, default=0, help="0 = no cap")
    ap.add_argument("--timeout-seconds", type=float, default=10.0)
    ap.add_argument("--boot-wait-seconds", type=float, default=2.0)
    return ap.parse_args()


def main() -> int:
    args = parse_args()
    checks = {c.strip().lower() for c in args.checks.split(",") if c.strip()}
    unknown = checks - {"manifest", "compose", "offline", "live"}
    if unknown:
        print(f"unknown checks: {sorted(unknown)}", file=sys.stderr)
        return 2
    apps = discover_manifests()
    print(f"discovered apps: {len(apps)}")
    errors: list[str] = []

    if "manifest" in checks:
        errors.extend(validate_manifests(apps))

    changed = changed_files(args.base_ref, args.head_ref) if args.mode == "changed" else set()
    selected = select_apps(
        apps,
        mode=args.mode,
        changed=changed,
        shard_index=args.shard_index,
        shard_count=args.shard_count,
        max_apps=args.max_apps,
    )
    print(f"selected apps: {len(selected)} (mode={args.mode}, shard={args.shard_index}/{args.shard_count})")
    if selected:
        print("sample:", ", ".join(a.app_id for a in selected[:12]))

    if "compose" in checks:
        try:
            service_names = load_compose_service_names()
            errors.extend(check_compose(selected, service_names))
        except Exception as exc:
            errors.append(f"compose check setup failed: {exc}")

    if "offline" in checks and selected:
        errors.extend(check_offline(selected, args.timeout_seconds, args.boot_wait_seconds))

    if "live" in checks and selected:
        errors.extend(check_live(selected, args.domain, args.timeout_seconds))

    if errors:
        print("\nQUALITY FAILURES:")
        for err in errors:
            print(f"- {err}")
        print(f"\nTotal failures: {len(errors)}")
        return 1

    print("quality checks passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
