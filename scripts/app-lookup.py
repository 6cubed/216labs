#!/usr/bin/env python3
"""Look up app manifest fields by app ID.

Usage:
  python3 scripts/app-lookup.py <app_id> build_spec
  python3 scripts/app-lookup.py <app_id> docker_service
  python3 scripts/app-lookup.py <app_id> internal_port

Fields:
  build_spec      Returns "context" or "context:dockerfile" (for deploy.sh service_spec)
  docker_service  Returns the docker-compose service name (may differ from app ID)
  internal_port   Returns the port the container listens on

Exits 0 on success, 1 if app not found.
"""
import sys
import json
import os

if len(sys.argv) < 3:
    print(f"Usage: {sys.argv[0]} <app_id> <field>", file=sys.stderr)
    sys.exit(1)

app_id = sys.argv[1]
field = sys.argv[2]

script_dir = os.path.dirname(os.path.abspath(__file__))
repo_root = os.path.dirname(script_dir)

for entry in os.listdir(repo_root):
    manifest_path = os.path.join(repo_root, entry, "manifest.json")
    if not os.path.isfile(manifest_path):
        continue
    try:
        with open(manifest_path) as f:
            m = json.load(f)
        if m.get("id") != app_id:
            continue
        if field == "build_spec":
            ctx = m.get("build_context", f"./{entry}")
            dfile = m.get("build_dockerfile")
            if dfile:
                print(f"{ctx}:{dfile}")
            else:
                print(ctx)
        elif field == "docker_service":
            print(m.get("docker_service", app_id))
        elif field == "internal_port":
            print(m.get("internal_port", 3000))
        elif field == "memory_limit":
            print(m.get("memory_limit", "256m"))
        else:
            print(m.get(field, ""), end="")
        sys.exit(0)
    except Exception:
        pass

sys.exit(1)
