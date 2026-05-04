#!/usr/bin/env python3
"""Scan full git history for high-signal secret patterns. Output is redacted."""
from __future__ import annotations

import re
import subprocess
import sys
from collections import defaultdict

REPO = subprocess.check_output(["git", "rev-parse", "--show-toplevel"], text=True).strip()

# Single POSIX ERE for git grep -e (one pass per commit)
MEGA_ERE = (
    r"ghp_[A-Za-z0-9]{36}|"
    r"github_pat_[A-Za-z0-9_]{22,}|"
    r"glpat-[A-Za-z0-9_-]{20,}|"
    r"sk_live_[0-9a-zA-Z]{24,}|"
    r"sk_test_[0-9a-zA-Z]{24,}|"
    r"xox[bap]-[0-9A-Za-z-]{10,}|"
    r"AIza[0-9A-Za-z_-]{35}|"
    r"AKIA[0-9A-Z]{16}|"
    r"ASIA[0-9A-Z]{16}|"
    r"AWS_SECRET_ACCESS_KEY\s*=\s*[^[:space:]#]+|"
    r"BEGIN[[:space:]]+(RSA[[:space:]]+|EC[[:space:]]+|OPENSSH[[:space:]]+)?PRIVATE[[:space:]]+KEY|"
    r"[[:digit:]]{8,10}:[A-Za-z0-9_-]{35}"
)

CLASSIFIERS: list[tuple[str, re.Pattern[str]]] = [
    ("github_classic_pat", re.compile(r"ghp_[A-Za-z0-9]{36}")),
    ("github_fine_pat", re.compile(r"github_pat_[A-Za-z0-9_]{22,}")),
    ("gitlab_pat", re.compile(r"glpat-[A-Za-z0-9_-]{20,}")),
    ("stripe_live", re.compile(r"sk_live_[0-9a-zA-Z]{24,}")),
    ("stripe_test", re.compile(r"sk_test_[0-9a-zA-Z]{24,}")),
    ("slack_token", re.compile(r"xox[bap]-[0-9A-Za-z-]{10,}")),
    ("google_api_key", re.compile(r"AIza[0-9A-Za-z_-]{35}")),
    ("aws_access_key_id", re.compile(r"A(SIA|KIA)[0-9A-Z]{16}")),
    ("aws_secret_env", re.compile(r"AWS_SECRET_ACCESS_KEY\s*=\s*\S+")),
    ("pem_private_key", re.compile(r"BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE\s+KEY")),
    ("telegram_bot_token", re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")),
]

EMAIL_ERE = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
EMAIL_PATH_HINT = re.compile(
    r"(\.env|credentials|secret|config/|\.ya?ml|\.json|\.toml|\.tf|\.pem|key|id_rsa)",
    re.I,
)
EMAIL_LINE = re.compile(EMAIL_ERE)


def redact_secrets(line: str) -> str:
    out = line
    for _name, rx in CLASSIFIERS:
        out = rx.sub(lambda m: m.group(0)[:4] + "[REDACTED]", out)
    return out


def main() -> int:
    commits = subprocess.check_output(
        ["git", "-C", REPO, "rev-list", "--all"], text=True
    ).split()
    sec_findings: dict[str, set[tuple[str, str, str]]] = defaultdict(set)

    for i, c in enumerate(commits):
        if i % 80 == 0:
            print(f"# secrets {i}/{len(commits)} commits", file=sys.stderr)
        try:
            proc = subprocess.run(
                [
                    "git",
                    "-C",
                    REPO,
                    "grep",
                    "-n",
                    "-E",
                    MEGA_ERE,
                    c,
                    "--",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            print(f"# timeout {c[:7]}", file=sys.stderr)
            continue
        if proc.returncode != 0 or not proc.stdout.strip():
            continue
        for raw in proc.stdout.splitlines():
            parts = raw.split(":", 2)
            if len(parts) < 3:
                continue
            path, _ln, content = parts[0], parts[1], parts[2]
            for pname, rx in CLASSIFIERS:
                if rx.search(content):
                    sec_findings[pname].add(
                        (c[:12], path, redact_secrets(content)[:240])
                    )
                    break

    email_findings: set[tuple[str, str, str]] = set()
    for i, c in enumerate(commits):
        if i % 80 == 0:
            print(f"# emails {i}/{len(commits)} commits", file=sys.stderr)
        try:
            proc = subprocess.run(
                [
                    "git",
                    "-C",
                    REPO,
                    "grep",
                    "-n",
                    "-E",
                    EMAIL_ERE,
                    c,
                    "--",
                ],
                capture_output=True,
                text=True,
                timeout=120,
            )
        except subprocess.TimeoutExpired:
            continue
        if proc.returncode != 0 or not proc.stdout.strip():
            continue
        skip_ext = (
            ".png",
            ".jpg",
            ".jpeg",
            ".gif",
            ".webp",
            ".ico",
            ".woff",
            ".woff2",
            ".lock",
            ".svg",
            ".pdf",
        )
        for raw in proc.stdout.splitlines():
            parts = raw.split(":", 2)
            if len(parts) < 3:
                continue
            path, _ln, content = parts[0], parts[1], parts[2]
            if path.endswith(skip_ext):
                continue
            if not EMAIL_PATH_HINT.search(path + content):
                continue
            em = EMAIL_LINE.search(content)
            if not em:
                continue
            full = em.group(0)
            if full.endswith((".png", ".jpg", ".gif")):
                continue
            local, _, domain = full.partition("@")
            masked = f"{local[:2]}***@{domain}"
            email_findings.add((c[:12], path, masked))

    print("## Git history audit (heuristic; verify each hit)\n")
    print(f"Repo: `{REPO}`\nCommits: {len(commits)}\n")

    if not sec_findings and not email_findings:
        print("No matches for bundled secret patterns; no email-like strings in sensitive-looking paths.")
        return 0

    if sec_findings:
        print("### Credential / key-like strings\n")
        for pname in sorted(sec_findings.keys()):
            rows = sorted(sec_findings[pname])
            print(f"**{pname}** — {len(rows)} hit(s)\n")
            for short, path, snippet in rows[:100]:
                print(f"- `{short}` `{path}`")
                print(f"  - {snippet}")
            if len(rows) > 100:
                print(f"- … {len(rows) - 100} more\n")
            print()

    if email_findings:
        print("### Email-shaped strings (path/content hint: env/config/credentials)\n")
        for short, path, masked in sorted(email_findings)[:150]:
            print(f"- `{short}` `{path}` → {masked}")
        if len(email_findings) > 150:
            print(f"\n… and {len(email_findings) - 150} more")
        print()

    print(
        "_Next steps: rotate any real credentials; use `git filter-repo` / BFG to purge "
        "specific paths or `git replace`+rewrite; force-push only after team coordination._"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
