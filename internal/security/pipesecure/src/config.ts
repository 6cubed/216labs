import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  github: {
    token: required("GITHUB_TOKEN"),
    repo: process.env.GITHUB_REPO || "6cubed/216labs",
    branch: process.env.GITHUB_BRANCH || "main",
  },
  dataDir: process.env.DATA_DIR || "/app/data",
  port: parseInt(process.env.PORT || "3000", 10),
};

export const [GITHUB_OWNER, GITHUB_REPO_NAME] = config.github.repo.split("/");
