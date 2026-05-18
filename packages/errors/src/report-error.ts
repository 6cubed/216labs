/**
 * Centralized client/server error ingest → admin public API (216labs.db.client_error_event).
 */

export type ReportErrorPayload = {
  app_id?: string;
  kind?: "client" | "server";
  message: string;
  stack?: string;
  url?: string;
};

function defaultEndpoint(): string {
  if (typeof window === "undefined") return "";
  const host = window.location.hostname;
  const parts = host.split(".");
  const base =
    parts.length >= 2 && parts[parts.length - 2] === "6cubed"
      ? "6cubed.app"
      : host.includes("localhost")
        ? "localhost"
        : parts.slice(-2).join(".");
  return `https://admin.${base}/api/public/report-error`;
}

function appIdFromHostname(): string {
  if (typeof window === "undefined") return "unknown";
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return "localhost";
  const m = host.match(/^([a-z0-9][a-z0-9.-]*)\.6cubed\.app$/);
  if (m) return m[1];
  if (host === "6cubed.app" || host === "www.6cubed.app") return "landing";
  return host.split(".")[0] || "unknown";
}

export async function reportError(
  payload: ReportErrorPayload,
  opts?: { endpoint?: string; appId?: string },
): Promise<void> {
  const endpoint = opts?.endpoint?.trim() || defaultEndpoint();
  if (!endpoint) return;

  const body: ReportErrorPayload = {
    app_id: payload.app_id || opts?.appId || appIdFromHostname(),
    kind: payload.kind || "client",
    message: payload.message,
    stack: payload.stack,
    url: payload.url || (typeof window !== "undefined" ? window.location.href : undefined),
  };

  try {
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      mode: "cors",
      credentials: "omit",
    });
  } catch {
    // Best-effort; never throw into app flow.
  }
}

export function installBrowserErrorReporting(opts?: {
  appId?: string;
  endpoint?: string;
}): void {
  if (typeof window === "undefined") return;

  const appId = opts?.appId || appIdFromHostname();
  const endpoint = opts?.endpoint;

  const send = (message: string, stack?: string) => {
    void reportError({ message, stack, kind: "client", app_id: appId }, { endpoint, appId });
  };

  window.addEventListener("error", (ev) => {
    const msg = ev.message || String(ev.error || "Error");
    const stack =
      ev.error instanceof Error
        ? ev.error.stack
        : ev.filename
          ? `${ev.filename}:${ev.lineno}:${ev.colno}`
          : undefined;
    send(msg, stack);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "Unhandled promise rejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    send(msg, stack);
  });
}
