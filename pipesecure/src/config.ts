import "dotenv/config";

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  github: {
    token: required("GITHUB_TOKEN"),
    repo: process.env.GITHUB_REPO || "216labs/216labs",
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET || "",
    branch: process.env.GITHUB_BRANCH || "main",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
  },
  scanOnStartup: process.env.SCAN_ON_STARTUP === "true",
  dataDir: process.env.DATA_DIR || "/app/data",
};

export const [GITHUB_OWNER, GITHUB_REPO_NAME] = config.github.repo.split("/");
