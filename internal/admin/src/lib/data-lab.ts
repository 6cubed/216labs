import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { getEnvVarValue } from "@/lib/db";
import { getProjectsRoot } from "@/lib/repo-paths";

const GITHUB_REPO = "6cubed/216labs";
const DATA_WORKFLOW_PATH = "data-jobs-mvp.yml";

export type DataJobConfig = {
  id: string;
  name: string;
  description: string;
  schedule: string;
  owner: string;
  status: string;
  path: string;
};

type GhWorkflowRun = {
  id: number;
  conclusion: string | null;
  status: string;
  created_at: string;
  run_started_at?: string;
  html_url: string;
  actor?: { login?: string };
  display_title?: string;
};

type GhWorkflowRunsResponse = { workflow_runs?: GhWorkflowRun[] };

export type DataJobRun = {
  id: string;
  startedAt: string;
  state: string;
  actor: string;
  title: string;
  url: string;
};

/** Used when repo `internal/data-jobs/jobs.json` is absent on the VPS (not in deploy checkout). */
const FALLBACK_DATA_JOBS: DataJobConfig[] = [
  {
    id: "web-scrape-demo",
    name: "Web Scrape Demo",
    description:
      "Scrape ~10k public rows, transform into a clean analytical dataset, and publish parquet + duckdb artifacts.",
    schedule: "0 6 * * *",
    owner: "data-lab",
    status: "active",
    path: "internal/data-jobs/web-scrape-demo/run_job.py",
  },
];

export function getDataJobsConfig(): DataJobConfig[] {
  const jobsPath = join(getProjectsRoot(), "internal", "data-jobs", "jobs.json");
  if (!existsSync(jobsPath)) return FALLBACK_DATA_JOBS;
  try {
    const raw = readFileSync(jobsPath, "utf-8");
    const parsed = JSON.parse(raw) as DataJobConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return FALLBACK_DATA_JOBS;
    return parsed;
  } catch {
    return FALLBACK_DATA_JOBS;
  }
}

export type DataJobRunsResult = {
  runs: DataJobRun[];
  /** Shown when runs are empty — token missing, API error, or no workflow yet */
  note: string | null;
};

export async function getRecentDataJobRuns(limit = 12): Promise<DataJobRunsResult> {
  const token = getEnvVarValue("ADMIN_GITHUB_TOKEN");
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${DATA_WORKFLOW_PATH}/runs?per_page=${Math.max(
    1,
    Math.min(25, limit),
  )}`;

  if (!token?.trim()) {
    return {
      runs: [],
      note: "Set ADMIN_GITHUB_TOKEN in Environment to load workflow runs from GitHub (Actions API).",
    };
  }

  try {
    const res = await fetch(url, { headers, cache: "no-store" });
    if (!res.ok) {
      const hint = res.status === 401 || res.status === 403
        ? "GitHub returned 401/403 — check token scopes (repo, actions:read)."
        : `GitHub API error (${res.status}).`;
      return { runs: [], note: hint };
    }
    const data = (await res.json()) as GhWorkflowRunsResponse;
    const runs = data.workflow_runs ?? [];
    const mapped = runs.map((run) => ({
      id: `run-${run.id}`,
      startedAt: run.run_started_at || run.created_at,
      state: run.conclusion || run.status || "unknown",
      actor: run.actor?.login || "github-actions",
      title: run.display_title || "Data jobs MVP run",
      url: run.html_url,
    }));
    return {
      runs: mapped,
      note:
        mapped.length === 0
          ? "No runs yet for workflow data-jobs-mvp.yml, or workflow name/path differs on GitHub."
          : null,
    };
  } catch {
    return { runs: [], note: "Could not reach GitHub API (network or TLS)." };
  }
}
