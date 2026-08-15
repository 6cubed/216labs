#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import sqlite3
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _run(cmd: list[str], *, cwd: Path) -> str:
    return subprocess.check_output(cmd, cwd=str(cwd), text=True).strip()


def _try_run(cmd: list[str], *, cwd: Path) -> str | None:
    try:
        return _run(cmd, cwd=cwd)
    except Exception:
        return None


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _repo_root() -> Path:
    try:
        root = _run(["git", "rev-parse", "--show-toplevel"], cwd=Path.cwd())
    except Exception as e:
        raise SystemExit(f"Not a git repo (or git unavailable): {e}")
    return Path(root)


def _count_manifests(root: Path) -> dict[str, int]:
    # Use git index (fast, respects repo reality) instead of filesystem glob.
    raw = _try_run(["git", "ls-files", "--", "**/manifest.json"], cwd=root) or ""
    manifests = [Path(p) for p in raw.splitlines() if p.strip()]
    prod = [p for p in manifests if p.parts and p.parts[0] == "products"]
    internal = [p for p in manifests if p.parts and p.parts[0] == "internal"]
    other = [p for p in manifests if p not in prod and p not in internal]
    return {
        "manifest_total": len(manifests),
        "manifest_products": len(prod),
        "manifest_internal": len(internal),
        "manifest_other": len(other),
    }


def _git_velocity(root: Path) -> dict[str, Any]:
    head = _try_run(["git", "rev-parse", "--short", "HEAD"], cwd=root)
    first = None
    try:
        roots = _run(["git", "rev-list", "--max-parents=0", "HEAD"], cwd=root).splitlines()
        dated: list[tuple[str, str]] = []
        for h in roots:
            d = _try_run(["git", "show", "-s", "--format=%cI", h], cwd=root)
            if d:
                dated.append((d, h))
        if dated:
            dated.sort(key=lambda t: t[0])
            first = dated[0][0]
    except Exception:
        first = None
    total = _try_run(["git", "rev-list", "--count", "HEAD"], cwd=root)
    last_7d = _try_run(["git", "rev-list", "--count", "--since=7 days ago", "HEAD"], cwd=root)
    last_30d = _try_run(["git", "rev-list", "--count", "--since=30 days ago", "HEAD"], cwd=root)
    return {
        "head": head,
        "first_commit_at": first,
        "commit_count_total": int(total) if (total and total.isdigit()) else None,
        "commit_count_7d": int(last_7d) if (last_7d and last_7d.isdigit()) else None,
        "commit_count_30d": int(last_30d) if (last_30d and last_30d.isdigit()) else None,
    }


@dataclass(frozen=True)
class DbMetrics:
    db_path: str
    ok: bool
    notes: list[str]
    data: dict[str, Any]


def _db_metrics(root: Path, *, db_path: Path) -> DbMetrics:
    notes: list[str] = []
    data: dict[str, Any] = {}

    if not db_path.exists():
        return DbMetrics(db_path=str(db_path), ok=False, notes=[f"DB not found at {db_path}"], data={})

    try:
        conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        conn.row_factory = sqlite3.Row
    except Exception as e:
        return DbMetrics(db_path=str(db_path), ok=False, notes=[f"Failed to open DB: {e}"], data={})

    def table_exists(name: str) -> bool:
        row = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1;", (name,)
        ).fetchone()
        return bool(row)

    def col_exists(table: str, col: str) -> bool:
        try:
            rows = conn.execute(f"PRAGMA table_info({table});").fetchall()
            return any(r["name"] == col for r in rows)
        except Exception:
            return False

    # Apps / enablement
    if table_exists("apps"):
        try:
            enabled_col = "deploy_enabled" if col_exists("apps", "deploy_enabled") else None
            if enabled_col:
                row = conn.execute(
                    "SELECT COUNT(*) AS total, SUM(CASE WHEN deploy_enabled=1 THEN 1 ELSE 0 END) AS enabled FROM apps;"
                ).fetchone()
                data["apps_total_db"] = int(row["total"])
                data["apps_enabled_db"] = int(row["enabled"] or 0)
            else:
                row = conn.execute("SELECT COUNT(*) AS total FROM apps;").fetchone()
                data["apps_total_db"] = int(row["total"])
                notes.append("apps.deploy_enabled column missing; enabled count unavailable")
        except Exception as e:
            notes.append(f"apps metrics failed: {e}")
    else:
        notes.append("apps table missing; enablement counts unavailable")

    # Error signals: client_error_event
    if table_exists("client_error_event"):
        try:
            for hours in (24, 168):
                row = conn.execute(
                    """
                    SELECT COUNT(*) AS n
                    FROM client_error_event
                    WHERE datetime(occurred_at) >= datetime('now', ?);
                    """,
                    (f"-{hours} hours",),
                ).fetchone()
                data[f"errors_reported_{hours}h"] = int(row["n"])

            top = conn.execute(
                """
                SELECT app_id, COUNT(*) AS n
                FROM client_error_event
                WHERE datetime(occurred_at) >= datetime('now', '-24 hours')
                GROUP BY app_id
                ORDER BY n DESC, app_id ASC
                LIMIT 10;
                """
            ).fetchall()
            data["errors_top_apps_24h"] = [{"app_id": r["app_id"], "n": int(r["n"])} for r in top]
        except Exception as e:
            notes.append(f"client_error_event metrics failed: {e}")
    else:
        notes.append("client_error_event table missing; error metrics unavailable")

    # Edge uniques: edge_visitor_day.
    # is_bot: 0 human, 1 bot/scanner, 2 recorded before bot filtering existed.
    if table_exists("edge_visitor_day"):
        has_is_bot = any(
            r[1] == "is_bot" for r in conn.execute("PRAGMA table_info(edge_visitor_day);").fetchall()
        )
        human_only = "AND is_bot = 0" if has_is_bot else ""
        if not has_is_bot:
            notes.append("edge_visitor_day predates bot filtering; counts include scanners")
        try:
            for days in (1, 7, 30):
                row = conn.execute(
                    f"""
                    SELECT COUNT(DISTINCT visitor_hash) AS uniques
                    FROM edge_visitor_day
                    WHERE day_utc >= date('now', ?) {human_only};
                    """,
                    (f"-{days} days",),
                ).fetchone()
                data[f"edge_uniques_{days}d"] = int(row["uniques"] or 0)

            if has_is_bot:
                row = conn.execute(
                    """
                    SELECT COUNT(DISTINCT visitor_hash) AS bots
                    FROM edge_visitor_day
                    WHERE day_utc >= date('now', '-30 days') AND is_bot = 1;
                    """
                ).fetchone()
                data["edge_bots_30d"] = int(row["bots"] or 0)

            top = conn.execute(
                f"""
                SELECT app_id, COUNT(DISTINCT visitor_hash) AS uniques
                FROM edge_visitor_day
                WHERE day_utc >= date('now', '-7 days') {human_only}
                GROUP BY app_id
                ORDER BY uniques DESC, app_id ASC
                LIMIT 10;
                """
            ).fetchall()
            data["edge_uniques_top_apps_7d"] = [
                {"app_id": r["app_id"], "uniques": int(r["uniques"] or 0)} for r in top
            ]
        except Exception as e:
            notes.append(f"edge_visitor_day metrics failed: {e}")
    else:
        notes.append("edge_visitor_day table missing; edge uniques unavailable")

    conn.close()
    return DbMetrics(db_path=str(db_path), ok=True, notes=notes, data=data)


def _to_markdown(report: dict[str, Any]) -> str:
    lines: list[str] = []
    lines.append("# 216labs org metrics (snapshot)")
    lines.append("")
    lines.append(f"- generated_at_utc: `{report['generated_at_utc']}`")
    lines.append(f"- repo_root: `{report['repo_root']}`")
    if report.get("git", {}).get("head"):
        lines.append(f"- head: `{report['git']['head']}`")
    lines.append("")

    git = report.get("git", {})
    lines.append("## Velocity (git)")
    lines.append("")
    lines.append(f"- commits_total: **{git.get('commit_count_total')}**")
    lines.append(f"- commits_7d: **{git.get('commit_count_7d')}**")
    lines.append(f"- commits_30d: **{git.get('commit_count_30d')}**")
    if git.get("first_commit_at"):
        lines.append(f"- first_commit_at: `{git.get('first_commit_at')}`")
    lines.append("")

    mf = report.get("manifests", {})
    lines.append("## Surface area (apps)")
    lines.append("")
    lines.append(f"- manifests_total: **{mf.get('manifest_total')}**")
    lines.append(f"- products: **{mf.get('manifest_products')}**")
    lines.append(f"- internal: **{mf.get('manifest_internal')}**")
    if mf.get("manifest_other"):
        lines.append(f"- other: **{mf.get('manifest_other')}**")
    lines.append("")

    db = report.get("db", {})
    lines.append("## Production signals (216labs.db)")
    lines.append("")
    lines.append(f"- db_path: `{db.get('db_path')}`")
    if not db.get("ok"):
        lines.append(f"- status: **unavailable** ({'; '.join(db.get('notes', []) or [])})")
        return "\n".join(lines) + "\n"

    data = db.get("data", {})
    if "apps_total_db" in data:
        lines.append(f"- apps_total_db: **{data.get('apps_total_db')}**")
    if "apps_enabled_db" in data:
        lines.append(f"- apps_enabled_db: **{data.get('apps_enabled_db')}**")
    if "errors_reported_24h" in data:
        lines.append(f"- errors_reported_24h: **{data.get('errors_reported_24h')}**")
    if "errors_reported_168h" in data:
        lines.append(f"- errors_reported_7d: **{data.get('errors_reported_168h')}**")
    if "edge_uniques_7d" in data:
        lines.append(f"- edge_uniques_7d: **{data.get('edge_uniques_7d')}**")
    if db.get("notes"):
        lines.append(f"- notes: `{'; '.join(db['notes'])}`")
    lines.append("")

    top_err = data.get("errors_top_apps_24h") or []
    if top_err:
        lines.append("### Top error apps (24h)")
        lines.append("")
        for r in top_err:
            lines.append(f"- `{r['app_id']}`: **{r['n']}**")
        lines.append("")

    top_edge = data.get("edge_uniques_top_apps_7d") or []
    if top_edge:
        lines.append("### Top edge uniques (7d)")
        lines.append("")
        for r in top_edge:
            lines.append(f"- `{r['app_id']}`: **{r['uniques']}**")
        lines.append("")

    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description="216labs org health metrics snapshot (md + json).")
    ap.add_argument("--json", action="store_true", help="print JSON instead of markdown")
    ap.add_argument(
        "--db",
        default=os.environ.get("ORG_METRICS_DB", ""),
        help="path to 216labs.db (default: ORG_METRICS_DB or repo-root/216labs.db)",
    )
    ap.add_argument(
        "--write",
        default="",
        help="write outputs to a directory (writes org-metrics.json and org-metrics.md)",
    )
    args = ap.parse_args()

    root = _repo_root()
    db_path = Path(args.db) if args.db else (root / "216labs.db")

    report: dict[str, Any] = {
        "generated_at_utc": _utc_now_iso(),
        "repo_root": str(root),
        "git": _git_velocity(root),
        "manifests": _count_manifests(root),
    }

    dbm = _db_metrics(root, db_path=db_path)
    report["db"] = {"db_path": dbm.db_path, "ok": dbm.ok, "notes": dbm.notes, "data": dbm.data}

    if args.json:
        out = json.dumps(report, indent=2, sort_keys=True)
    else:
        out = _to_markdown(report)

    if args.write:
        out_dir = Path(args.write)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / "org-metrics.json").write_text(
            json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8"
        )
        (out_dir / "org-metrics.md").write_text(_to_markdown(report), encoding="utf-8")

    sys.stdout.write(out + ("\n" if (args.json and not out.endswith("\n")) else ""))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

