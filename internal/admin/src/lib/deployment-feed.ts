import {
  type DbDeploymentEvent,
  getDeploymentEventsFromDb,
  getEnvVarValue,
  parseOccurredAtMs,
} from "@/lib/db";

const GITHUB_REPO = "6cubed/216labs";
const GHCR_WORKFLOW_PATH = "ghcr-publish.yml";

export type DeploymentFeedChannel = "vps" | "app" | "ci" | "snapshot";

/** Unified row for dashboard + public API — VPS deploys, per-app rollouts, CI, legacy snapshots. */
export type UnifiedDeploymentFeedItem = {
  id: string;
  occurredAtMs: number;
  channel: DeploymentFeedChannel;
  headline: string;
  detail: string;
  href?: string;
  appId?: string;
};

type GhWorkflowRun = {
  id: number;
  name?: string;
  conclusion: string | null;
  created_at: string;
  html_url: string;
  head_branch?: string;
  head_commit?: { message?: string };
  display_title?: string;
};

type GhWorkflowRunsResponse = { workflow_runs?: GhWorkflowRun[] };

function dbEventToItem(row: DbDeploymentEvent): UnifiedDeploymentFeedItem | null {
  const occurredAtMs = parseOccurredAtMs(row.occurred_at);
  if (!Number.isFinite(occurredAtMs)) return null;

  let channel: DeploymentFeedChannel = "snapshot";
  if (row.event_type === "droplet") channel = "vps";
  else if (row.event_type === "app_rollout") channel = "app";
  else if (row.event_type === "github_workflow") channel = "ci";

  const href = row.ref_url?.trim() || undefined;
  const appId = row.app_id?.trim() || undefined;

  return {
    id: `db:${row.id}`,
    occurredAtMs,
    channel,
    headline: row.title,
    detail: row.body?.trim() || "",
    href,
    appId,
  };
}

async function fetchGhcrWorkflowRuns(limit: number): Promise<UnifiedDeploymentFeedItem[]> {
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
    const out: UnifiedDeploymentFeedItem[] = [];
    for (const run of runs) {
      const ms = Date.parse(run.created_at);
      if (!Number.isFinite(ms)) continue;
      const conclusion = run.conclusion || "in_progress";
      const commitMsg = run.head_commit?.message?.split("\n")[0]?.trim() || "";
      const title =
        run.display_title?.trim() ||
        run.name ||
        "Publish images to GHCR";
      const detail =
        conclusion === "success"
          ? `CI · ${commitMsg || "main"}`
          : `CI · ${conclusion}${commitMsg ? ` — ${commitMsg.slice(0, 80)}` : ""}`;
      out.push({
        id: `gha:${run.id}`,
        occurredAtMs: ms,
        channel: "ci",
        headline: title,
        detail,
        href: run.html_url,
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * Single timeline: SQLite deployment_events (VPS + per-app + legacy) + GitHub Actions GHCR workflow runs.
 */
export async function getUnifiedDeploymentFeed(
  limit = 80,
): Promise<UnifiedDeploymentFeedItem[]> {
  const dbLimit = Math.min(200, Math.max(limit * 2, 40));
  const fromDb = getDeploymentEventsFromDb(dbLimit)
    .map(dbEventToItem)
    .filter((x): x is UnifiedDeploymentFeedItem => x !== null);

  const fromGh = await fetchGhcrWorkflowRuns(Math.min(25, Math.ceil(limit / 2)));

  const merged = [...fromDb, ...fromGh];
  merged.sort((a, b) => b.occurredAtMs - a.occurredAtMs);
  return merged.slice(0, limit);
}
