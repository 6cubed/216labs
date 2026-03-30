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
import re
import subprocess
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable


REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "internal" / "python"))
from labs_http import http_probe  # noqa: E402
APP_ID_RE = re.compile(r"^[a-z0-9][a-z0-9.-]*$")
DOCKER_NAME_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_.-]*$")
SHARED_REBUILD_PATHS = {
    "docker-compose.yml",
    "Caddyfile",
    "scripts/generate-compose.py",
    "scripts/generate-caddyfile.py",
    "scripts/quality-factory.py",
    "scripts/compose-ghcr-matrix.py",
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


@dataclass
class CheckReport:
    status: str
    detail: str = ""


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
        if changed and any(
            p in SHARED_REBUILD_PATHS
            or p.startswith(".github/workflows/")
            or p.startswith("internal/python/")
            for p in changed
        ):
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
    return http_probe(url, timeout_s, user_agent="quality-factory/1.0")


def _check_live_one(app: AppManifest, domain: str, timeout_s: float, retries: int) -> CheckReport:
    attempts = max(1, retries + 1)
    last_detail = ""
    for i in range(attempts):
        url = f"https://{app.app_id}.{domain}"
        code, body = _http_probe(url, timeout_s)
        if code is None:
            last_detail = f"probe failed ({body})"
        elif code >= 500:
            last_detail = f"live probe returned {code}"
        elif "unknown app" in body.lower() and "not in admin db" in body.lower():
            last_detail = "live probe shows activator unknown-app page"
        else:
            return CheckReport(status="pass", detail=f"ok ({code})")
        if i < attempts - 1:
            time.sleep(0.7 * (i + 1))
    return CheckReport(status="fail", detail=last_detail)


def check_live(
    selected: list[AppManifest],
    domain: str,
    timeout_s: float,
    retries: int,
) -> tuple[list[str], dict[str, CheckReport]]:
    errs: list[str] = []
    reports: dict[str, CheckReport] = {}
    for app in selected:
        rep = _check_live_one(app, domain, timeout_s, retries)
        reports[app.app_id] = rep
        if rep.status == "fail":
            errs.append(f"{app.app_id}: {rep.detail}")
    return errs, reports


def _docker_build_tag(app: AppManifest) -> str:
    return f"qf-{app.app_id}:ci"


def _docker_run_name(app: AppManifest) -> str:
    suffix = hashlib.sha1(app.app_id.encode("utf-8")).hexdigest()[:10]
    return f"qf-{app.app_id}-{suffix}"


def check_offline(
    selected: list[AppManifest],
    timeout_s: float,
    boot_wait_s: float,
    retries: int,
) -> tuple[list[str], dict[str, CheckReport]]:
    errs: list[str] = []
    reports: dict[str, CheckReport] = {}
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
            attempts = max(1, retries + 1)
            for i in range(attempts):
                for url in urls:
                    code, body = _http_probe(url, timeout_s)
                    if code is not None and code < 500:
                        ok = True
                        reports[app.app_id] = CheckReport(status="pass", detail=f"ok ({code})")
                        break
                    if code is None and "Connection refused" in body:
                        time.sleep(0.4)
                if ok:
                    break
                if i < attempts - 1:
                    time.sleep(0.8 * (i + 1))
            if not ok:
                logs = _run(["docker", "logs", run_name], check=False).stdout[-2000:]
                detail = f"offline probe failed ({urls[0]}). logs tail:\n{logs}"
                reports[app.app_id] = CheckReport(status="fail", detail=detail)
                errs.append(f"{app.app_id}: {detail}")
        except subprocess.CalledProcessError as e:
            snippet = (e.stderr or e.stdout or "").strip()[-2000:]
            detail = f"docker build/run failed: {snippet}"
            reports[app.app_id] = CheckReport(status="fail", detail=detail)
            errs.append(f"{app.app_id}: {detail}")
        finally:
            _run(["docker", "rm", "-f", run_name], check=False)
    return errs, reports


def load_quarantine(path: Path | None) -> dict[str, set[str]]:
    out = {"offline": set(), "live": set()}
    if path is None or not path.exists():
        return out
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return out
    for key in ("offline", "live"):
        values = data.get(f"{key}_skip", [])
        if isinstance(values, list):
            out[key] = {str(v).strip() for v in values if str(v).strip()}
    return out


def write_reports(
    *,
    path_json: Path | None,
    path_md: Path | None,
    checks: set[str],
    selected: list[AppManifest],
    errors: list[str],
    check_reports: dict[str, dict[str, CheckReport]],
    quarantined: dict[str, set[str]],
) -> None:
    rows: list[dict[str, str]] = []
    for app in selected:
        row = {"app_id": app.app_id, "rel_dir": app.rel_dir}
        for check in ("manifest", "compose", "offline", "live"):
            if check not in checks:
                row[check] = "not_run"
                continue
            if app.app_id in quarantined.get(check, set()):
                row[check] = "quarantined"
                continue
            rep = check_reports.get(check, {}).get(app.app_id)
            row[check] = rep.status if rep else "not_run"
        rows.append(row)
    payload = {
        "generated_at_epoch": int(time.time()),
        "total_apps": len(selected),
        "total_failures": len(errors),
        "errors": errors,
        "rows": rows,
    }
    if path_json:
        path_json.parent.mkdir(parents=True, exist_ok=True)
        path_json.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    if path_md:
        path_md.parent.mkdir(parents=True, exist_ok=True)
        lines = [
            "# Quality Scorecard",
            "",
            f"- Total apps: {len(selected)}",
            f"- Total failures: {len(errors)}",
            "",
            "| app_id | manifest | compose | offline | live |",
            "|---|---:|---:|---:|---:|",
        ]
        for row in rows:
            lines.append(
                f"| {row['app_id']} | {row['manifest']} | {row['compose']} | {row['offline']} | {row['live']} |"
            )
        if errors:
            lines.extend(["", "## Failures"])
            lines.extend([f"- {e}" for e in errors[:200]])
        path_md.write_text("\n".join(lines) + "\n", encoding="utf-8")


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
    ap.add_argument("--retries", type=int, default=1, help="Retries per app probe after initial attempt")
    ap.add_argument("--quarantine-file", default="config/quality-quarantine.json")
    ap.add_argument("--report-json", default="")
    ap.add_argument("--report-md", default="")
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
    check_reports: dict[str, dict[str, CheckReport]] = {
        "manifest": {},
        "compose": {},
        "offline": {},
        "live": {},
    }

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
    quarantined = load_quarantine((REPO_ROOT / args.quarantine_file) if args.quarantine_file else None)
    for check_name, ids in quarantined.items():
        if ids:
            print(f"quarantine {check_name}: {len(ids)} app(s)")

    if "compose" in checks:
        try:
            service_names = load_compose_service_names()
            compose_errors = check_compose(selected, service_names)
            errors.extend(compose_errors)
            missing = {e.split(":", 1)[0] for e in compose_errors}
            for app in selected:
                check_reports["compose"][app.app_id] = (
                    CheckReport(status="fail", detail="missing docker_service")
                    if app.app_id in missing
                    else CheckReport(status="pass", detail="service present")
                )
        except Exception as exc:
            errors.append(f"compose check setup failed: {exc}")

    if "offline" in checks and selected:
        offline_targets = [a for a in selected if a.app_id not in quarantined.get("offline", set())]
        for app in selected:
            if app.app_id in quarantined.get("offline", set()):
                check_reports["offline"][app.app_id] = CheckReport(status="quarantined", detail="skipped by quarantine file")
        off_errors, off_reports = check_offline(
            offline_targets,
            args.timeout_seconds,
            args.boot_wait_seconds,
            args.retries,
        )
        errors.extend(off_errors)
        check_reports["offline"].update(off_reports)

    if "live" in checks and selected:
        live_targets = [a for a in selected if a.app_id not in quarantined.get("live", set())]
        for app in selected:
            if app.app_id in quarantined.get("live", set()):
                check_reports["live"][app.app_id] = CheckReport(status="quarantined", detail="skipped by quarantine file")
        live_errors, live_reports = check_live(live_targets, args.domain, args.timeout_seconds, args.retries)
        errors.extend(live_errors)
        check_reports["live"].update(live_reports)

    # Manifest check applies to all selected apps from discovered set.
    if "manifest" in checks:
        bad_ids: set[str] = set()
        for e in errors:
            if ": invalid app id " in e or ": duplicate app id " in e or ": invalid docker_service " in e or ": invalid internal_port " in e:
                bad_ids.add(e.split(":", 1)[0].split("/")[-1])
        for app in selected:
            check_reports["manifest"][app.app_id] = (
                CheckReport(status="fail", detail="manifest validation error")
                if app.app_id in bad_ids
                else CheckReport(status="pass", detail="ok")
            )

    report_json = Path(args.report_json) if args.report_json else None
    report_md = Path(args.report_md) if args.report_md else None
    write_reports(
        path_json=report_json,
        path_md=report_md,
        checks=checks,
        selected=selected,
        errors=errors,
        check_reports=check_reports,
        quarantined=quarantined,
    )

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
