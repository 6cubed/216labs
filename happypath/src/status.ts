import { createServer } from "http";
import { getStatusData } from "./db.js";
import { config } from "./config.js";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso + "Z");
  return (
    d.toLocaleString("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "UTC",
    }) + " UTC"
  );
}

function renderPage(): string {
  const { lastRun, resultsByApp, enabledApps } = getStatusData();
  const total = lastRun?.total ?? 0;
  const passed = lastRun?.passed ?? 0;
  const failed = lastRun?.failed ?? 0;
  const finishedAt = lastRun?.finished_at
    ? formatDate(lastRun.finished_at)
    : "no run yet";
  const nextHours = config.testIntervalHours;

  const rows = enabledApps
    .map((appId) => {
      const r = resultsByApp.get(appId);
      const status = r
        ? r.passed
          ? { color: "#16a34a", text: "Pass", icon: "✓" }
        : { color: "#dc2626", text: "Fail", icon: "✗" }
        : { color: "#6b7280", text: "—", icon: "—" };
      const message = r?.message ? escHtml(r.message) : "";
      const url = `https://${appId}.${config.appHost}`;
      return `
        <tr>
          <td style="padding:10px 12px;font-weight:500;">${escHtml(appId)}</td>
          <td style="padding:10px 12px;">
            <span style="color:${status.color};font-weight:600;">${status.icon} ${status.text}</span>
          </td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;">${message}</td>
          <td style="padding:10px 12px;font-size:12px;">
            <a href="${url}" target="_blank" rel="noopener" style="color:#2563eb;">${escHtml(url)}</a>
          </td>
          <td style="padding:10px 12px;color:#6b7280;font-size:12px;">${r ? formatDate(r.created_at) : "—"}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Happy Path — 216labs</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #111827; }
    a { color: inherit; }
    table { width: 100%; border-collapse: collapse; }
    tr:not(:last-child) td { border-bottom: 1px solid #f1f5f9; }
    tr:hover td { background: #f8fafc; }
  </style>
</head>
<body>
<div style="max-width:960px;margin:0 auto;padding:32px 20px;">

  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
    <span style="font-size:22px;">🧪</span>
    <h1 style="font-size:20px;font-weight:700;">Happy Path</h1>
  </div>
  <div style="margin-bottom:24px;font-size:13px;color:#6b7280;">
    Common-sense clickthrough tests for 216labs apps · runs every ${nextHours}h
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
      <div style="font-size:28px;font-weight:700;color:#16a34a;">${passed}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px;">Passed</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
      <div style="font-size:28px;font-weight:700;color:#dc2626;">${failed}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px;">Failed</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
      <div style="font-size:13px;font-weight:500;color:#374151;">Last run</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">${finishedAt}</div>
    </div>
  </div>

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    <table>
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">App</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Status</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Message</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">URL</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Last tested</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div style="margin-top:16px;text-align:center;font-size:12px;color:#9ca3af;">
    Auto-refreshes every 5 min · <a href="" style="color:#9ca3af;">Refresh now</a>
  </div>

</div>
<script>setTimeout(() => location.reload(), 300_000);</script>
</body>
</html>`;
}

export function startStatusServer(port: number): void {
  const server = createServer((_req, res) => {
    try {
      const html = renderPage();
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
    } catch (err) {
      res.writeHead(500);
      res.end("Error rendering status page");
    }
  });

  server.listen(port, () => {
    console.log(`[happypath] Status page on http://0.0.0.0:${port}`);
  });
}
