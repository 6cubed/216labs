import os
import re

from flask import Flask

app = Flask(__name__)

_GA_MEASUREMENT_ID_RE = re.compile(r"^G-[A-Z0-9]+$")


def _ga_snippet() -> str:
    raw = os.environ.get("GA_MEASUREMENT_ID", "").strip()
    if not raw or not _GA_MEASUREMENT_ID_RE.match(raw):
        return ""
    return (
        f'<script async src="https://www.googletagmanager.com/gtag/js?id={raw}"></script>'
        "<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments);}}"
        f"gtag('js',new Date());gtag('config','{raw}');</script>"
    )


@app.get("/")
def home():
    ga = _ga_snippet()
    return (
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>"
        f"<title>Hello Flask</title>{ga}</head><body>"
        "<h1>Hello from Flask</h1>"
        "<p>Minimal demo app — same manifest, compose, and Caddy routing as other services. "
        "Delete or replace when you ship real products.</p></body></html>"
    )


@app.get("/healthz")
def healthz():
    return {"ok": True}
