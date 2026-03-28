#!/usr/bin/env python3
"""Copy internal/web-shared/ga4 into each Next.js app and ensure root layout loads Ga4Script."""
from __future__ import annotations

import re
import shutil
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
SRC = REPO / "internal/web-shared/ga4"
FILES = ["Ga4Script.tsx", "Ga4ScriptInner.tsx"]

IMPORT_LINE = 'import { Ga4Script } from "@/components/ga4/Ga4Script";'
TAG = "<Ga4Script />"


def find_package_root(layout: Path) -> Path | None:
    cur = layout.parent
    while True:
        if (cur / "package.json").is_file():
            return cur
        if cur.parent == cur:
            return None
        cur = cur.parent


def insert_import_after_imports(text: str) -> str:
    if IMPORT_LINE in text:
        return text
    lines = text.splitlines(keepends=True)
    insert_at = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("import "):
            insert_at = i + 1
            continue
        if stripped == "" or stripped.startswith("//"):
            continue
        if stripped in ('"use client";', "'use client';"):
            continue
        break
    lines.insert(insert_at, IMPORT_LINE + "\n")
    return "".join(lines)


def inject_body_tag(text: str) -> str:
    if TAG in text:
        return text
    m = re.search(r"<body[^>]*>", text)
    if not m:
        return text
    return text[: m.end()] + "\n        " + TAG + "\n" + text[m.end() :]


def patch_layout(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    if "Ga4Script" in text:
        return False
    text = insert_import_after_imports(text)
    text = inject_body_tag(text)
    if TAG not in text:
        print("WARN: could not inject Ga4Script in", path)
        return False
    path.write_text(text, encoding="utf-8")
    return True


def main() -> None:
    layouts = list((REPO / "products").rglob("src/app/layout.tsx"))
    layouts.append(REPO / "internal/admin/src/app/layout.tsx")
    for layout in sorted(layouts):
        if not layout.is_file():
            continue
        pkg = find_package_root(layout)
        if pkg is None:
            continue
        pj = (pkg / "package.json").read_text(encoding="utf-8")
        if '"next"' not in pj and "'next'" not in pj:
            continue
        dest_dir = pkg / "src/components/ga4"
        dest_dir.mkdir(parents=True, exist_ok=True)
        for name in FILES:
            shutil.copy2(SRC / name, dest_dir / name)
        if patch_layout(layout):
            print("patched", layout.relative_to(REPO))


if __name__ == "__main__":
    main()
