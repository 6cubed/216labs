/**
 * Job handlers: each returns a string (message to send to Telegram).
 * Signature: async (db, opts) => string
 * opts: { HAPPYPATH_INTERNAL_URL }
 */

export async function telegramDailyDigest(db, _opts) {
  const total = db.prepare("SELECT COUNT(*) as n FROM apps").get().n;
  const enabled = db
    .prepare("SELECT COUNT(*) as n FROM apps WHERE deploy_enabled = 1")
    .get().n;
  const recent = db
    .prepare(
      "SELECT id, last_deployed_at FROM apps WHERE deploy_enabled = 1 AND last_deployed_at IS NOT NULL ORDER BY last_deployed_at DESC LIMIT 5"
    )
    .all();
  const lines = [
    `216labs daily — ${total} apps, ${enabled} deployed.`,
    "",
    "Last deploys:",
    ...recent.map((r) => `  ${r.id}: ${r.last_deployed_at || "—"}`),
  ];
  return lines.join("\n");
}

export async function telegramHappypathSummary(_db, opts) {
  const base = opts.HAPPYPATH_INTERNAL_URL.replace(/\/$/, "");
  const url = `${base}/api/status`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return `Happy Path: status unavailable (${res.status}). See ${base}`;
    const data = await res.json();
    const { lastRun, resultsByApp, enabledApps } = data;
    if (!lastRun)
      return `Happy Path: no run yet. See ${base}`;
    const total = lastRun.total ?? 0;
    const passed = lastRun.passed ?? 0;
    const failed = lastRun.failed ?? 0;
    const finished = lastRun.finished_at
      ? new Date(lastRun.finished_at + "Z").toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "UTC",
        }) + " UTC"
      : "—";
    const fails =
      enabledApps?.filter((id) => resultsByApp?.[id]?.passed === 0) ?? [];
    const lines = [
      `Happy Path: ${passed}/${total} passed, ${failed} failed. Last run: ${finished}.`,
      fails.length ? `Failed: ${fails.join(", ")}` : null,
      base,
    ].filter(Boolean);
    return lines.join("\n");
  } catch (err) {
    return `Happy Path: error — ${err.message}. See ${base}`;
  }
}

export async function telegramSecuritySummary(_db, _opts) {
  return "PipeSecure/Semgrep summary: run manually or configure pipeline. See GitHub issues for 216labs.";
}

export async function telegramWeeklyLint(_db, _opts) {
  return "Weekly lint report: run `npm run lint` in repo or connect CI.";
}

export const HANDLERS = {
  "telegram-daily-digest": telegramDailyDigest,
  "telegram-happypath-summary": telegramHappypathSummary,
  "telegram-security-summary": telegramSecuritySummary,
  "telegram-weekly-lint": telegramWeeklyLint,
};
