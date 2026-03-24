from flask import Flask

app = Flask(__name__)


@app.get("/")
def home():
    return (
        "<h1>Hello from Flask</h1>"
        "<p>Minimal demo app — same manifest, compose, and Caddy routing as other services. "
        "Delete or replace when you ship real products.</p>"
    )


@app.get("/healthz")
def healthz():
    return {"ok": True}
