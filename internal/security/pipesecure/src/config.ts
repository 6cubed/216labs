import "dotenv/config";

/** Data directory — safe without GitHub credentials */
export const dataDir = process.env.DATA_DIR || "/app/data";

export const githubBranch = process.env.GITHUB_BRANCH || "main";

export interface ScanTarget {
  fullName: string;
  owner: string;
  name: string;
  branch: string;
}

function parseRepoSpec(spec: string, defaultBranch: string): ScanTarget {
  const trimmed = spec.trim();
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx < 0) {
    throw new Error(`Invalid repo spec (need owner/name): ${spec}`);
  }
  const atIdx = trimmed.indexOf("@", slashIdx + 1);
  let repoPart: string;
  let branch: string;
  if (atIdx >= 0) {
    repoPart = trimmed.slice(0, atIdx);
    branch = trimmed.slice(atIdx + 1) || defaultBranch;
  } else {
    repoPart = trimmed;
    branch = defaultBranch;
  }
  const [owner, name] = repoPart.split("/");
  if (!owner?.trim() || !name?.trim()) {
    throw new Error(`Invalid repo spec: ${spec}`);
  }
  return {
    fullName: `${owner}/${name}`,
    owner: owner.trim(),
    name: name.trim(),
    branch,
  };
}

/**
 * Repos to scan. Set `GITHUB_REPOS` or `PIPESECURE_GITHUB_REPOS` to a comma- or
 * newline-separated list of `owner/repo` or `owner/repo@branch`. If unset, uses
 * `GITHUB_REPO` (single repo) + `GITHUB_BRANCH`.
 */
export function scanTargets(): ScanTarget[] {
  const defaultBranch = githubBranch;
  const raw = (process.env.GITHUB_REPOS || process.env.PIPESECURE_GITHUB_REPOS || "").trim();
  if (!raw) {
    const single = process.env.GITHUB_REPO || "6cubed/216labs";
    return [parseRepoSpec(single, defaultBranch)];
  }
  const specs = raw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
  return specs.map((s) => parseRepoSpec(s, defaultBranch));
}

/** Primary repo label (first target) for backwards-compatible display. */
export function primaryGithubRepo(): string {
  const t = scanTargets();
  return t[0]?.fullName ?? "6cubed/216labs";
}

/** Log findings only; do not create or close GitHub issues. */
export function dryRunIssues(): boolean {
  const v = (process.env.PIPESECURE_DRY_RUN || "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}

/** Returns null if scans / GitHub API should be disabled (UI still serves). */
export function githubToken(): string | null {
  const t = process.env.GITHUB_TOKEN?.trim();
  return t || null;
}

/** Narrow object for templates that only need repo metadata */
export const config = {
  dataDir,
  github: {
    repo: primaryGithubRepo(),
    branch: githubBranch,
  },
};
