from __future__ import annotations

import hmac
import json
import os
import secrets
from hashlib import sha256


class FlagConfigError(RuntimeError):
    pass


def _pepper() -> bytes:
    p = os.environ.get("CTFBENCH_FLAG_PEPPER", "")
    p = p.strip() if isinstance(p, str) else ""
    if not p:
        raise FlagConfigError("CTFBENCH_FLAG_PEPPER is required")
    return p.encode("utf-8")


def load_expected_hmacs() -> dict[str, str]:
    raw = os.environ.get("CTFBENCH_FLAG_HMACS_JSON", "")
    raw = raw.strip() if isinstance(raw, str) else ""
    if raw:
        d = json.loads(raw)
        if isinstance(d, dict):
            return {str(k): str(v) for k, v in d.items()}

    path = os.environ.get("CTFBENCH_FLAG_HMACS_PATH", "/app/data/ctfbench_flag_hmacs.json").strip()
    if path and os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        if isinstance(d, dict):
            return {str(k): str(v) for k, v in d.items()}

    raise FlagConfigError("Missing expected flag digests (CTFBENCH_FLAG_HMACS_JSON or CTFBENCH_FLAG_HMACS_PATH)")


def flag_hmac_hex(flag: str) -> str:
    key = _pepper()
    msg = (flag or "").strip().encode("utf-8")
    return hmac.new(key, msg, sha256).hexdigest()


def verify_flag(challenge_id: str, flag: str) -> bool:
    expected = load_expected_hmacs().get(str(challenge_id), "")
    expected = expected.strip().lower()
    if not expected:
        return False
    got = flag_hmac_hex(flag)
    return secrets.compare_digest(got, expected)


def solver_fingerprint(ip: str, ua: str, name: str) -> str:
    # Not security. Just de-dupe spam and double-submits per challenge.
    base = f"{ip}|{ua}|{name}".encode("utf-8", errors="ignore")
    return sha256(base).hexdigest()

