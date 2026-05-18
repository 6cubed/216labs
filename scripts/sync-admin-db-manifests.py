#!/usr/bin/env python3
"""Upsert apps + env_var keys in 216labs.db from on-disk manifest.json files.

Use when the admin DB is stale or after recovery (deploy.sh reads enabled apps from here).
Does not delete existing rows or overwrite env secret values.
"""
from __future__ import annotations

import json
import sqlite3
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))
import importlib.util

_spec = importlib.util.spec_from_file_location(
    "quality_factory", REPO_ROOT / "scripts" / "quality-factory.py"
)
_qf = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_qf)
discover_manifests = _qf.discover_manifests

DB_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else REPO_ROOT / "216labs.db"


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
    apps = discover_manifests()
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    today = date.today().isoformat()
    existing_ports = {
        int(r["port"])
        for r in conn.execute("SELECT port FROM apps WHERE port > 0").fetchall()
    }
    next_port = max([8000] + list(existing_ports)) + 1

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
    for m in apps:
        mp = m.abs_dir / "manifest.json"
        data = json.loads(mp.read_text(encoding="utf-8"))
        svc = m.docker_service
        img = f"216labs/{svc}:latest"
        sf = (data.get("stack") or {}).get("frontend")
        sb = (data.get("stack") or {}).get("backend")
        sd = (data.get("stack") or {}).get("database")
        so = _stack_other(data)
        mem = str(data.get("memory_limit", "256m"))
        row = conn.execute("SELECT id, port FROM apps WHERE id = ?", (m.app_id,)).fetchone()
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
                )
            )
            updated += 1
        else:
            port = int(data.get("internal_port", m.internal_port)) or next_port
            while port in existing_ports:
                port = next_port
                next_port += 1
            existing_ports.add(port)
            deploy_on = 1 if m.app_id == "admin" else 0
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
                    deploy_on,
                    mem,
                    today,
                    today,
                )
            )
            added += 1
        for ev in data.get("env_vars") or []:
            if not isinstance(ev, dict):
                continue
            key = str(ev.get("key", "")).strip()
            if not key:
                continue
            conn.execute(
                insert_env_sql,
                (
                    key,
                    str(ev.get("description", "")),
                    1 if ev.get("is_secret") else 0,
                )
            )

    conn.commit()
    total = conn.execute("SELECT COUNT(*) FROM apps").fetchone()[0]
    conn.close()
    print(f"synced manifests: {len(apps)} ({added} inserted, {updated} updated); apps in DB: {total}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
