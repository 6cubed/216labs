#!/usr/bin/env python3
"""Upsert apps + env_var keys in 216labs.db from on-disk manifest.json files.

Use when the admin DB is stale or after recovery (deploy.sh reads enabled apps from here).
Does not delete existing rows or overwrite env secret values.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from dataclasses import dataclass
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DB_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "216labs.db"


@dataclass(frozen=True)
class ManifestRow:
    app_id: str
    rel_dir: str
    docker_service: str
    internal_port: int
    abs_dir: Path


def discover_manifests() -> list[ManifestRow]:
    out: list[ManifestRow] = []
    top_skip = {".git", ".cursor", "node_modules", ".venv", "venv", "__pycache__"}
    for root in ("products", "internal"):
        base = REPO_ROOT / root
        if not base.is_dir():
            continue
        stack: list[tuple[Path, str]] = [(base, root)]
        while stack:
            abs_dir, rel = stack.pop()
            if (abs_dir / "manifest.json").is_file():
                data = json.loads((abs_dir / "manifest.json").read_text(encoding="utf-8"))
                app_id = str(data.get("id", "")).strip()
                svc = str(data.get("docker_service", app_id)).strip() or app_id
                port = int(data.get("internal_port", 3000))
                out.append(
                    ManifestRow(
                        app_id=app_id,
                        rel_dir=rel,
                        docker_service=svc,
                        internal_port=port,
                        abs_dir=abs_dir,
                    )
                )
            # Keep traversing when a parent also has manifest.json (e.g. internal/admin + difftinder).
            try:
                entries = list(abs_dir.iterdir())
            except OSError:
                continue
            for entry in entries:
                if not entry.is_dir() or entry.name.startswith(".") or entry.name in top_skip:
                    continue
                stack.append((entry, f"{rel}/{entry.name}"))
    return sorted(out, key=lambda m: m.app_id)


def _stack_other(data: dict) -> str | None:
    other = (data.get("stack") or {}).get("other")
    if other is None:
        return None
    if isinstance(other, list):
        return ", ".join(str(x) for x in other if x)
    return str(other)


def main() -> int:
    if not DB_PATH.is_file():
        print(f"DB not found: {DB_PATH}", file=sys.stderr)
        return 1
    manifests = discover_manifests()
    conn = sqlite3.connect(DB_PATH)
    today = date.today().isoformat()
    existing_ports = {
        int(r[0]) for r in conn.execute("SELECT port FROM apps WHERE port > 0").fetchall()
    }
    next_port = max([8000, *existing_ports]) + 1

    insert_sql = """
        INSERT INTO apps (
          id, name, tagline, description, category, port,
          docker_service, docker_image, directory, repo_path,
          stack_frontend, stack_backend, stack_database, stack_other,
          deploy_enabled, memory_limit,
          created_at, last_updated, total_commits,
          marketing_monthly, marketing_channel, marketing_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 'Organic', NULL)
        """
    update_sql = """
        UPDATE apps SET
          name = ?, tagline = ?, description = ?, category = ?,
          docker_service = ?, docker_image = ?, directory = ?, repo_path = ?,
          stack_frontend = ?, stack_backend = ?, stack_database = ?, stack_other = ?,
          memory_limit = ?
        WHERE id = ?
        """
    insert_env_sql = """
        INSERT OR IGNORE INTO env_vars (key, value, description, is_secret, updated_at)
        VALUES (?, '', ?, ?, NULL)
        """

    added = updated = 0
    for m in manifests:
        data = json.loads((m.abs_dir / "manifest.json").read_text(encoding="utf-8"))
        svc = m.docker_service
        img = f"216labs/{svc}:latest"
        stack = data.get("stack") or {}
        sf, sb, sd = stack.get("frontend"), stack.get("backend"), stack.get("database")
        so = _stack_other(data)
        mem = str(data.get("memory_limit", "256m"))
        row = conn.execute("SELECT id FROM apps WHERE id = ?", (m.app_id,)).fetchone()
        if row:
            conn.execute(
                update_sql,
                (
                    data.get("name", m.app_id),
                    data.get("tagline", ""),
                    data.get("description", ""),
                    data.get("category", "consumer"),
                    svc,
                    img,
                    m.rel_dir,
                    m.rel_dir,
                    sf,
                    sb,
                    sd,
                    so,
                    mem,
                    m.app_id,
                ),
            )
            updated += 1
        else:
            port = m.internal_port if m.internal_port > 0 else next_port
            while port in existing_ports:
                port = next_port
                next_port += 1
            existing_ports.add(port)
            conn.execute(
                insert_sql,
                (
                    m.app_id,
                    data.get("name", m.app_id),
                    data.get("tagline", ""),
                    data.get("description", ""),
                    data.get("category", "consumer"),
                    port,
                    svc,
                    img,
                    m.rel_dir,
                    m.rel_dir,
                    sf,
                    sb,
                    sd,
                    so,
                    1 if m.app_id == "admin" else 0,
                    mem,
                    today,
                    today,
                ),
            )
            added += 1
        for ev in data.get("env_vars") or []:
            if not isinstance(ev, dict):
                continue
            key = str(ev.get("key", "")).strip()
            if key:
                conn.execute(
                    insert_env_sql,
                    (key, str(ev.get("description", "")), 1 if ev.get("is_secret") else 0),
                )

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM apps").fetchone()[0]
    conn.close()
    print(f"synced manifests: {len(manifests)} ({added} inserted, {updated} updated); apps in DB: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
