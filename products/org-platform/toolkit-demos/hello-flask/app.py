import os
import re
import traceback

from flask import Flask, request

from client_error_report import report_server_error

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


def _client_error_snippet() -> str:
    return """<script>
(function () {
  var endpoint = "https://admin.6cubed.app/api/public/report-error";
  function send(kind, message, stack) {
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ app_id: "hello-flask", kind: kind, message: message, stack: stack || "" })
      });
    } catch (e) {}
  }
  window.addEventListener("error", function (e) {
    send("client", e.message || String(e.error), e.error && e.error.stack);
  });
  window.addEventListener("unhandledrejection", function (e) {
    send("client", String((e.reason && e.reason.message) || e.reason), e.reason && e.reason.stack);
  });
})();
</script>"""


@app.get("/")
def home():
    ga = _ga_snippet()
    err = _client_error_snippet()
    return (
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'/>"
        f"<title>Hello Flask</title>{ga}{err}</head><body>"
        "<h1>Hello from Flask</h1>"
        "<p>Minimal demo app — same manifest, compose, and Caddy routing as other services. "
        "Delete or replace when you ship real products.</p></body></html>"
    )


@app.get("/healthz")
def healthz():
    return {"ok": True}


@app.errorhandler(500)
def internal_error(exc: Exception):
    report_server_error(
        "hello-flask",
        str(exc),
        stack=traceback.format_exc(),
        url=request.url if request else "",
    )
    return "Internal Server Error", 500
