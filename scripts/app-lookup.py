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
  env_prefix      Optional; for admin env grouping (e.g. ONEPAGE). Default: id uppercased.

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


def iter_manifest_dirs():
    """Yield (rel_path, abs_path) for each project directory that has manifest.json."""
    skip_top = {"scripts", "apps", "products", "internal", "node_modules"}
    for entry in os.listdir(repo_root):
        if entry.startswith(".") or entry in skip_top:
            continue
        path = os.path.join(repo_root, entry)
        if os.path.isdir(path):
            yield entry, path
    for root_name in ("products", "internal"):
        base = os.path.join(repo_root, root_name)
        if not os.path.isdir(base):
            continue
        stack = [(base, root_name)]
        while stack:
            dirpath, rel = stack.pop()
            for name in os.listdir(dirpath):
                if name.startswith(".") or name == "node_modules":
                    continue
                sub = os.path.join(dirpath, name)
                rel_sub = f"{rel}/{name}"
                if not os.path.isdir(sub):
                    continue
                if os.path.isfile(os.path.join(sub, "manifest.json")):
                    yield rel_sub.replace("\\", "/"), sub
                else:
                    stack.append((sub, rel_sub))


for rel_dir, abs_path in iter_manifest_dirs():
    manifest_path = os.path.join(abs_path, "manifest.json")
    if not os.path.isfile(manifest_path):
        continue
    try:
        with open(manifest_path) as f:
            m = json.load(f)
        if m.get("id") != app_id:
            continue
        if field == "build_spec":
            ctx = m.get("build_context", f"./{rel_dir}")
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
        elif field == "env_prefix":
            prefix = m.get("env_prefix")
            if prefix:
                print(prefix)
            else:
                # Default: id uppercased, non-alnum -> underscore
                print(app_id.upper().replace("-", "_").replace(".", "_"))
        else:
            print(m.get(field, ""), end="")
        sys.exit(0)
    except Exception:
        pass

sys.exit(1)
