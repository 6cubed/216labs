import { createServer } from "http";
import { getStatusData } from "./db";
import { config, githubToken, scanTargets } from "./config";

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#dc2626",
  high:     "#ea580c",
  medium:   "#d97706",
  low:      "#2563eb",
  info:     "#6b7280",
};

const SEVERITY_BG: Record<string, string> = {
  critical: "#fef2f2",
  high:     "#fff7ed",
  medium:   "#fffbeb",
  low:      "#eff6ff",
  info:     "#f9fafb",
};

function badge(severity: string, count: number): string {
  if (count === 0) return "";
  const color = SEVERITY_COLOR[severity] ?? "#6b7280";
  const bg = SEVERITY_BG[severity] ?? "#f9fafb";
  return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:13px;font-weight:600;color:${color};background:${bg};border:1px solid ${color}22;">${severity.toUpperCase()} ${count}</span>`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = new Date(iso + "Z");
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) + " UTC";
}

function renderPage(): string {
  const tokenMissing = !githubToken();
  const { openIssues, bySeverity, lastScan } = getStatusData();
  const targets = scanTargets();
  const primaryRepo = config.github.repo;
  const primaryRepoUrl = `https://github.com/${primaryRepo}`;
  const watchLine =
    targets.length <= 2
      ? targets.map((t) => `<a href="https://github.com/${t.fullName}" target="_blank" style="color:#2563eb;">${t.fullName}</a>`).join(" · ")
      : `${targets.length} repositories (e.g. <a href="${primaryRepoUrl}" target="_blank" style="color:#2563eb;">${primaryRepo}</a>)`;

  const totalOpen = openIssues.length;
  const scanFinished = lastScan?.finished_at ? formatDate(lastScan.finished_at) : "no scan yet";
  const scanFindings = lastScan?.findings ?? "—";
  const nextScanHours = process.env.SCAN_INTERVAL_HOURS || "24";

  const issueRows = openIssues
    .sort((a, b) => {
      const order = ["critical", "high", "medium", "low", "info"];
      return order.indexOf(a.severity) - order.indexOf(b.severity);
    })
    .map((issue) => {
      const color = SEVERITY_COLOR[issue.severity] ?? "#6b7280";
      const issueRepo = issue.github_repo || primaryRepo;
      const issueRepoUrl = `https://github.com/${issueRepo}`;
      const issueLink = issue.issue_number
        ? `<a href="${issueRepoUrl}/issues/${issue.issue_number}" target="_blank" style="color:#2563eb;text-decoration:none;">#${issue.issue_number}</a>`
        : "—";
      return `
        <tr>
          <td style="padding:10px 12px;white-space:nowrap;">
            <span style="color:${color};font-weight:600;font-size:12px;text-transform:uppercase;">${issue.severity}</span>
          </td>
          <td style="padding:10px 12px;font-size:12px;"><a href="${issueRepoUrl}" target="_blank" style="color:#6b7280;text-decoration:none;">${escHtml(issueRepo)}</a></td>
          <td style="padding:10px 12px;font-weight:500;">${escHtml(issue.title)}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:13px;font-family:monospace;">${escHtml(issue.file_path)}</td>
          <td style="padding:10px 12px;font-size:13px;">${issueLink}</td>
          <td style="padding:10px 12px;color:#6b7280;font-size:12px;white-space:nowrap;">${formatDate(issue.created_at)}</td>
        </tr>`;
    })
    .join("");

  const emptyState = totalOpen === 0
    ? `<div style="text-align:center;padding:48px 0;color:#6b7280;">
        <div style="font-size:40px;margin-bottom:12px;">✅</div>
        <div style="font-size:16px;font-weight:500;">No open security issues</div>
        <div style="font-size:13px;margin-top:6px;">Last scan found nothing to report</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PipeSecure — ${escHtml(primaryRepo)}${targets.length > 1 ? ` +${targets.length - 1}` : ""}</title>
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
${tokenMissing ? `
  <div style="background:#fef3c7;border-bottom:1px solid #f59e0b;color:#92400e;padding:12px 20px;text-align:center;font-size:14px;">
    <strong>GitHub token not configured.</strong> The status page is live, but automated scans are disabled until <code style="background:#fffbeb;padding:2px 6px;border-radius:4px;">PIPESECURE_GITHUB_TOKEN</code> / <code style="background:#fffbeb;padding:2px 6px;border-radius:4px;">GITHUB_TOKEN</code> is set on the host.
  </div>` : ""}
<div style="max-width:900px;margin:0 auto;padding:32px 20px;">

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;flex-wrap:wrap;gap:12px;">
    <div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:22px;">🔒</span>
        <h1 style="font-size:20px;font-weight:700;">PipeSecure</h1>
      </div>
      <div style="margin-top:4px;font-size:13px;color:#6b7280;">
        Watching ${watchLine} · scans every ${nextScanHours}h
      </div>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
      <div style="font-size:28px;font-weight:700;color:${totalOpen > 0 ? "#dc2626" : "#16a34a"};">${totalOpen}</div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px;">Open issues</div>
    </div>
    <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:16px 20px;">
      <div style="font-size:13px;font-weight:500;color:#374151;">Last scan</div>
      <div style="font-size:13px;color:#6b7280;margin-top:4px;">${scanFinished}</div>
      <div style="font-size:12px;color:#9ca3af;margin-top:2px;">${scanFindings} findings</div>
    </div>
  </div>

  ${totalOpen > 0 ? `
  <div style="margin-bottom:12px;display:flex;gap:6px;flex-wrap:wrap;">
    ${Object.entries(bySeverity).filter(([, n]) => n > 0).map(([s, n]) => badge(s, n)).join("")}
  </div>` : ""}

  <div style="background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;">
    ${totalOpen > 0 ? `
    <table>
      <thead>
        <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Severity</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Repo</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Finding</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">File</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Issue</th>
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:.05em;">Detected</th>
        </tr>
      </thead>
      <tbody>${issueRows}</tbody>
    </table>` : emptyState}
  </div>

  <div style="margin-top:16px;text-align:center;font-size:12px;color:#9ca3af;">
    Auto-refreshes every 5 minutes · <a href="" style="color:#9ca3af;">Refresh now</a>
  </div>

</div>
<script>setTimeout(() => location.reload(), 300_000);</script>
</body>
</html>`;
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    console.log(`[pipesecure] Status page on http://0.0.0.0:${port}`);
  });
}
