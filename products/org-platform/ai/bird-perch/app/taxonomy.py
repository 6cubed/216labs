"""Optional eBird taxonomy CSV → species code → human-readable label."""

from __future__ import annotations

import csv
import os
import re
from pathlib import Path

_APP_DIR = Path(__file__).resolve().parent
_DEFAULT_TAXONOMY = _APP_DIR.parent / "data" / "ebird_taxonomy.csv"

# Official Cornell / Clements checklist CSV (large). Override with BIRDPERCH_EBIRD_TAXONOMY_URL.
_DEFAULT_TAXONOMY_URL = "https://www.birds.cornell.edu/clementschecklist/wp-content/uploads/2026/04/eBird_taxonomy_v2025-4.csv"

_cache_map: dict[str, str] | None = None
_cache_path: str | None = None
_cache_mtime: float | None = None
_last_ensure_error: str | None = None


def reset_taxonomy_cache() -> None:
    """Clear cached mapping so the next request reloads from disk."""
    global _cache_map, _cache_path, _cache_mtime
    _cache_map = None
    _cache_path = None
    _cache_mtime = None


def ensure_taxonomy_csv(path: str | None = None, url: str | None = None) -> tuple[bool, str]:
    """Ensure a taxonomy CSV exists on disk (download if missing).

    Returns (present, resolved_path). Never raises on download failure.
    """
    global _last_ensure_error
    resolved = path or os.environ.get("BIRDPERCH_EBIRD_TAXONOMY_CSV", "").strip() or str(_DEFAULT_TAXONOMY)
    resolved = resolved.strip()
    if not resolved:
        return False, ""
    if os.path.isfile(resolved) and os.path.getsize(resolved) > 10_000:
        _last_ensure_error = None
        return True, resolved

    fetch_url = (url or os.environ.get("BIRDPERCH_EBIRD_TAXONOMY_URL", "").strip() or _DEFAULT_TAXONOMY_URL).strip()
    if not fetch_url:
        return False, resolved

    try:
        import httpx

        os.makedirs(os.path.dirname(resolved) or ".", exist_ok=True)
        tmp = f"{resolved}.tmp"
        with httpx.Client(follow_redirects=True, timeout=60) as client:
            # Cornell sometimes blocks "unknown" user agents; send a browser-ish UA.
            r = client.get(
                fetch_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; 216labs-birdperch/1.0)",
                    "Accept": "text/csv,text/plain,*/*",
                },
            )
            r.raise_for_status()
            # Write bytes as-is; CSV is UTF-8.
            with open(tmp, "wb") as f:
                f.write(r.content)
        # Validate quickly before swapping into place.
        mapping = parse_ebird_taxonomy_csv(tmp)
        if not mapping:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            return False, resolved
        os.replace(tmp, resolved)
        reset_taxonomy_cache()
        _last_ensure_error = None
        return True, resolved
    except Exception as e:
        _last_ensure_error = f"{type(e).__name__}: {e}"
        return False, resolved


def last_taxonomy_ensure_error() -> str | None:
    return _last_ensure_error


def _norm_header(h: str) -> str:
    return h.strip().lower().replace(" ", "_")


def _pick_field(fieldnames: list[str] | None, *candidates: str) -> str | None:
    if not fieldnames:
        return None
    norm = {_norm_header(h): h for h in fieldnames}
    for c in candidates:
        if c in norm:
            return norm[c]
    return None


def _fuzzy_pick(fieldnames: list[str], *needles: str) -> str | None:
    """First column whose normalized header contains all lowercase substrings."""
    for h in fieldnames:
        hn = _norm_header(h)
        if all(n in hn for n in needles):
            return h
    return None


def parse_ebird_taxonomy_csv(path: str) -> dict[str, str]:
    """Return uppercased species code -> display string (common name, optional scientific)."""
    out: dict[str, str] = {}
    with open(path, encoding="utf-8", errors="replace", newline="") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return out
        fn = list(reader.fieldnames)
        code_col = _pick_field(fn, "species_code", "speciescode") or _fuzzy_pick(
            fn, "species", "code"
        )
        common_col = _pick_field(
            fn,
            "common_name",
            "commonname",
            "english_name",
            "primary_common_name",
        ) or _fuzzy_pick(fn, "common", "name")
        sci_col = _pick_field(fn, "scientific_name", "scientificname", "sci_name") or _fuzzy_pick(
            fn, "scientific", "name"
        )
        cat_col = _pick_field(fn, "category")
        if not code_col or not common_col:
            return out
        for row in reader:
            code = (row.get(code_col) or "").strip()
            common = (row.get(common_col) or "").strip()
            if not code or not common:
                continue
            if cat_col:
                cat = (row.get(cat_col) or "").strip().lower()
                if cat and cat not in ("species", "issf", "slash", "hybrid"):
                    continue
            sci = (row.get(sci_col) or "").strip() if sci_col else ""
            label = f"{common} ({sci})" if sci else common
            out[code.upper()] = label.strip()
    return out


def load_species_code_map() -> dict[str, str]:
    """Load taxonomy mapping if CSV path exists (env or default under app data/)."""
    global _cache_map, _cache_path, _cache_mtime
    paths: list[str] = []
    envp = os.environ.get("BIRDPERCH_EBIRD_TAXONOMY_CSV", "").strip()
    if envp:
        paths.append(envp)
    paths.append(str(_DEFAULT_TAXONOMY))

    path = next((p for p in paths if p and os.path.isfile(p)), None)
    if not path:
        _cache_map = {}
        _cache_path = None
        _cache_mtime = None
        return {}

    mtime = os.path.getmtime(path)
    if _cache_map is not None and _cache_path == path and _cache_mtime == mtime:
        return _cache_map

    _cache_map = parse_ebird_taxonomy_csv(path)
    _cache_path = path
    _cache_mtime = mtime
    return _cache_map


_EBIRD_CODE = re.compile(r"^[A-Za-z]{4}\d?$")


def heuristic_display(raw: str) -> str:
    """Best-effort readable string when no taxonomy row matches."""
    s = (raw or "").strip()
    if not s:
        return "Unknown"
    if " / " in s:
        return s.split(" / ", 1)[0].strip()
    if "_" in s and not s.islower():
        return " ".join(w.capitalize() for w in s.replace("-", "_").split("_") if w)
    if "_" in s:
        return " ".join(w.capitalize() for w in s.replace("-", "_").split("_") if w)
    if _EBIRD_CODE.match(s):
        return s
    return s


def species_display(raw_label: str, tax: dict[str, str]) -> tuple[str, str | None]:
    """Return (display_name, species_code) for API; species_code is the raw classifier label when helpful."""
    raw = (raw_label or "").strip()
    if not raw:
        return "Unknown", None
    key = raw.upper()
    if key in tax:
        return tax[key], raw
    disp = heuristic_display(raw)
    if disp != raw:
        return disp, raw
    if _EBIRD_CODE.match(raw) and disp == raw:
        return f"{raw} (add BIRDPERCH_EBIRD_TAXONOMY_CSV for common names)", raw
    return disp, None
