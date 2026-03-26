import "dotenv/config";

/** Data directory — safe without GitHub credentials */
export const dataDir = process.env.DATA_DIR || "/app/data";

export const githubRepo = process.env.GITHUB_REPO || "6cubed/216labs";
export const githubBranch = process.env.GITHUB_BRANCH || "main";

/** Returns null if scans / GitHub API should be disabled (UI still serves). */
export function githubToken(): string | null {
  const t = process.env.GITHUB_TOKEN?.trim();
  return t || null;
}

export const [GITHUB_OWNER, GITHUB_REPO_NAME] = githubRepo.split("/");

/** Narrow object for templates that only need repo metadata */
export const config = {
  dataDir,
  github: {
    repo: githubRepo,
    branch: githubBranch,
  },
};
