import {
  getDb,
  getDeploymentEventsFromDb,
  getEnvVarValue,
  parseOccurredAtMs,
  type DbDeploymentEvent,
} from "@/lib/db";

const GITHUB_REPO = "6cubed/216labs";
const GHCR_WORKFLOW_PATH = "ghcr-publish.yml";

/** Heuristic: deployment log line looks like a problem (not exhaustive). */
const DEPLOY_ALERT = /fail|error|denied|unauthorized|no such image|timeout|oom|killed|exception|crash|502|503|504|refused|cannot|unable to/i;

/** Success-ish phrases to avoid false positives on deployment_events. */
const DEPLOY_OK = /completed successfully|deploy completed|compose \/ ghcr pull$/i;

export type AdminErrorItem = {
  id: string;
  source: "runtime" | "deployment" | "ci";
  severity: "error" | "warn";
  occurredAtMs: number;
  headline: string;
  detail: string;
  appId?: string;
  href?: string;
};

type GhWorkflowRun = {
  id: number;
  name?: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  head_commit?: { message?: string };
  display_title?: string;
};

type GhWorkflowRunsResponse = { workflow_runs?: GhWorkflowRun[] };

function appPublicUrl(appId: string): string {
  const host = process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app";
  return `https://${appId}.${host}`;
}

function deploymentEventToItem(row: DbDeploymentEvent): AdminErrorItem | null {
  const occurredAtMs = parseOccurredAtMs(row.occurred_at);
  if (!Number.isFinite(occurredAtMs)) return null;
  const blob = `${row.title}\n${row.body || ""}`;
  if (!DEPLOY_ALERT.test(blob)) return null;
  if (DEPLOY_OK.test(blob) && !/fail|error|denied/i.test(blob)) return null;

  return {
    id: `deploy:${row.id}`,
    source: "deployment",
    severity: "warn",
    occurredAtMs,
    headline: row.title,
    detail: (row.body || "").trim() || "(no detail)",
    appId: row.app_id?.trim() || undefined,
    href: row.ref_url?.trim() || undefined,
  };
}

async function fetchFailedGhcrRuns(limit: number): Promise<AdminErrorItem[]> {
  const token = getEnvVarValue("ADMIN_GITHUB_TOKEN");
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${GHCR_WORKFLOW_PATH}/runs?per_page=${limit}&branch=main`;

  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = (await res.json()) as GhWorkflowRunsResponse;
    const runs = data.workflow_runs ?? [];
    const out: AdminErrorItem[] = [];
    for (const run of runs) {
      const c = run.conclusion;
      if (!c || c === "success" || c === "skipped") continue;
      if (c === "in_progress" || c === "queued" || c === "waiting" || c === "requested")
        continue;
      const ms = Date.parse(run.created_at);
      if (!Number.isFinite(ms)) continue;
      const commitMsg = run.head_commit?.message?.split("\n")[0]?.trim() || "";
      const title =
        run.display_title?.trim() || run.name || "Publish images to GHCR";
      out.push({
        id: `ci:${run.id}`,
        source: "ci",
        severity: "error",
        occurredAtMs: ms,
        headline: `CI · ${title}`,
        detail: `Workflow conclusion: ${c}${commitMsg ? ` — ${commitMsg.slice(0, 120)}` : ""}`,
        href: run.html_url,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Aggregates activator runtime errors, suspicious deployment_events rows, and failed GHCR workflow runs.
 */
export async function getAdminErrorFeed(limit = 60): Promise<AdminErrorItem[]> {
  const items: AdminErrorItem[] = [];
  const db = getDb();

  const runtimeRows = db
    .prepare(
      `SELECT id, name, runtime_status, last_runtime_error, last_started_at, last_accessed_at
       FROM apps
       WHERE (
         (last_runtime_error IS NOT NULL AND TRIM(last_runtime_error) != '')
         OR (runtime_status IS NOT NULL AND TRIM(runtime_status) = 'failed')
       )`,
    )
    .all() as Array<{
      id: string;
      name: string;
      runtime_status: string | null;
      last_runtime_error: string | null;
      last_started_at: string | null;
      last_accessed_at: string | null;
    }>;

  for (const r of runtimeRows) {
    const err = (r.last_runtime_error || "").trim();
    const ts =
      r.last_started_at ||
      r.last_accessed_at ||
      new Date().toISOString();
    const ms = parseOccurredAtMs(ts) || Date.now();
    const headline = err
      ? `${r.name} (${r.id})`
      : `${r.name} — runtime failed`;
    const detail =
      err ||
      (r.runtime_status === "failed"
        ? "runtime_status=failed (no error message stored)"
        : "");
    items.push({
      id: `runtime:${r.id}:${ms}`,
      source: "runtime",
      severity: "error",
      occurredAtMs: ms,
      headline,
      detail,
      appId: r.id,
      href: appPublicUrl(r.id),
    });
  }

  const deployLimit = Math.min(200, Math.max(limit * 3, 60));
  const deployRows = getDeploymentEventsFromDb(deployLimit);
  for (const row of deployRows) {
    const item = deploymentEventToItem(row);
    if (item) items.push(item);
  }

  const ciItems = await fetchFailedGhcrRuns(Math.min(20, Math.ceil(limit / 2)));
  items.push(...ciItems);

  items.sort((a, b) => b.occurredAtMs - a.occurredAtMs);
  return items.slice(0, limit);
}
