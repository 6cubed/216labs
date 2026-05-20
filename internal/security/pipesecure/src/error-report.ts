const INGEST = "https://admin.6cubed.app/api/public/report-error";

/** Inline script: POST browser errors to admin public ingest. */
export function clientErrorScript(appId: string): string {
  const id = JSON.stringify(appId.trim().toLowerCase());
  return `<script>
(function () {
  var endpoint = ${JSON.stringify(INGEST)};
  var appId = ${id};
  function send(kind, message, stack) {
    try {
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          app_id: appId,
          kind: kind,
          message: message,
          stack: stack || ""
        })
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
</script>`;
}

/** Best-effort server error POST (scan/render failures). */
export function reportServerError(
  appId: string,
  message: string,
  stack = "",
  url = "",
): void {
  const body = {
    app_id: appId.trim().toLowerCase(),
    kind: "server",
    message: message.trim().slice(0, 2000),
    stack: stack.slice(0, 8000) || undefined,
    url: url.slice(0, 500) || undefined,
  };
  void fetch(INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(() => {});
}
