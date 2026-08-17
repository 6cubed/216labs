#!/usr/bin/env python3
"""In-repo cold-host, wrong-GitHub-org, and always-on paid-pilot login-wall leftovers.

Live always-on HTML is scanned by heartbeat-stack.sh. This week's leftovers were
in cold-app templates and Colab markdown — this scan covers those without starting
the apps. Hire-pin plaintext (no href) is ignored on purpose. Anonymous
issues/new?template=paid-pilot 302s to GitHub login — flag that href on always-on
apps (dest is 6cubed.app/#work). Keep the template on README/colabs/research.

Usage: python3 scripts/scan-cold-refs.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

COLD = ("blog.6cubed.app", "agitweet.6cubed.app", "merch.6cubed.app", "marketing.6cubed.app")
WRONG_ORG = re.compile(r"(?<!6cubed/)github[.]com/216labs")
ATTR = re.compile(r"""(?:href|src|action)\s*=\s*["']([^"']+)["']""", re.I)
FETCH = re.compile(r"""fetch\(\s*["']([^"']+)["']""")
MARKDOWN = re.compile(r"\]\((https?://[^)\s]+)\)")
EXTS = {".html", ".tsx", ".jsx", ".md", ".ipynb", ".vue", ".js"}
SKIP_DIR = {"node_modules", ".git", ".next", "dist", "__pycache__"}
LOGIN_WALL = "issues/new?template=paid-pilot"
ALWAYS_ON_PREFIX = (
    "products/org-growth/ads/landing/",
    "products/org-lifestyle/play/anchor/",
    "products/org-lifestyle/geo/zurichrunclubs/",
    "products/org-lifestyle/play/storybook/",
    "products/org-lifestyle/play/kidgift/",
    "products/org-platform/ai/1pageresearch/",
    "products/org-lifestyle/play/maxlearn/",
)
SELF_PREFIX = (
    "products/org-media/blog/",
    "products/org-growth/ads/merch/",
    "products/org-social/agitweet/",
    "products/org-growth/ads/marketing/",
)
WALK = ("products", "colabs", "research")


def refs_in(text: str) -> list[str]:
    out = ATTR.findall(text) + FETCH.findall(text) + MARKDOWN.findall(text)
    return out


def is_self(rel: str) -> bool:
    return any(rel.startswith(p) for p in SELF_PREFIX)


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    hits: list[str] = []
    for top in WALK:
        base = root / top
        if not base.is_dir():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIR]
            for name in filenames:
                path = Path(dirpath) / name
                if path.suffix.lower() not in EXTS:
                    continue
                rel = path.relative_to(root).as_posix()
                if is_self(rel):
                    continue
                try:
                    text = path.read_text(encoding="utf-8", errors="replace")
                except OSError:
                    continue
                for url in refs_in(text):
                    cold = [c for c in COLD if c in url]
                    gh = bool(WRONG_ORG.search(url))
                    wall = LOGIN_WALL in url and any(rel.startswith(p) for p in ALWAYS_ON_PREFIX)
                    if not cold and not gh and not wall:
                        continue
                    if wall:
                        why = "paid-pilot login wall"
                    elif cold:
                        why = ",".join(cold)
                    else:
                        why = "github.com/216labs"
                    line = f"  {rel} {url} ({why})"
                    hits.append(line)
                    print(line)
                    if wall:
                        print("  (live dest is https://6cubed.app/#work; keep paid-pilot.yml on README/colabs/research)")
    if hits:
        print("  (strip href/markdown — do not start those apps)")
        return 1
    print("  (none — no href/markdown to blog, agitweet, merch, marketing; no github.com/216labs; no always-on paid-pilot login wall)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
