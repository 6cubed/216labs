import { Octokit } from "@octokit/rest";
import { createAppAuth } from "@octokit/auth-app";
import { createHmac, timingSafeEqual } from "crypto";
import { readFileSync } from "fs";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import os from "os";
import fs from "fs/promises";

const execAsync = promisify(exec);

let _privateKey: string | null = null;

function getAppPrivateKey(): string {
  if (_privateKey) return _privateKey;

  const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH;
  if (keyPath) {
    const resolved = path.resolve(keyPath);
    _privateKey = readFileSync(resolved, "utf-8");
    return _privateKey;
  }

  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    _privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    return _privateKey;
  }

  throw new Error("No GitHub App private key configured. Set GITHUB_APP_PRIVATE_KEY_PATH or GITHUB_APP_PRIVATE_KEY.");
}

export function getUserOctokit(accessToken: string) {
  return new Octokit({ auth: accessToken });
}

export function getInstallationOctokit(installationId: number) {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: {
      appId: process.env.GITHUB_APP_ID!,
      privateKey: getAppPrivateKey(),
      installationId,
    },
  });
}

export async function listUserRepos(accessToken: string) {
  const octokit = getUserOctokit(accessToken);
  const repos = await octokit.paginate(octokit.repos.listForAuthenticatedUser, {
    sort: "updated",
    per_page: 100,
    visibility: "all",
  });
  return repos.map((repo) => ({
    id: repo.id,
    fullName: repo.full_name,
    name: repo.name,
    private: repo.private,
    defaultBranch: repo.default_branch,
    language: repo.language,
    updatedAt: repo.updated_at,
  }));
}

export async function cloneRepo(
  repoFullName: string,
  accessToken: string,
  branch?: string
): Promise<string> {
  const tmpDir = path.join(os.tmpdir(), "pipesecure-scans", `${repoFullName.replace("/", "-")}-${Date.now()}`);
  await fs.mkdir(tmpDir, { recursive: true });

  const cloneUrl = `https://x-access-token:${accessToken}@github.com/${repoFullName}.git`;
  const branchFlag = branch ? `--branch ${branch}` : "";
  await execAsync(`git clone --depth 1 ${branchFlag} "${cloneUrl}" "${tmpDir}"`, {
    timeout: 120000,
  });

  return tmpDir;
}

export async function cloneRepoWithInstallation(
  repoFullName: string,
  installationId: number,
  branch?: string
): Promise<string> {
  const octokit = getInstallationOctokit(installationId);
  const { data } = await octokit.apps.createInstallationAccessToken({
    installation_id: installationId,
  });

  return cloneRepo(repoFullName, data.token, branch);
}

export async function cleanupRepo(repoPath: string): Promise<void> {
  try {
    await fs.rm(repoPath, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
}

export async function createRepoWebhook(
  accessToken: string,
  repoFullName: string
): Promise<number | null> {
  const webhookUrl = process.env.NEXTAUTH_URL || process.env.APP_URL;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookUrl || !webhookSecret) {
    console.warn("[webhook] Cannot create webhook: NEXTAUTH_URL or GITHUB_WEBHOOK_SECRET not set");
    return null;
  }

  const octokit = getUserOctokit(accessToken);
  const [owner, repo] = repoFullName.split("/");

  try {
    const { data } = await octokit.repos.createWebhook({
      owner,
      repo,
      config: {
        url: `${webhookUrl}/api/github/webhook`,
        content_type: "json",
        secret: webhookSecret,
      },
      events: ["push"],
      active: true,
    });
    console.log(`[webhook] Created webhook ${data.id} for ${repoFullName}`);
    return data.id;
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? (error as { status: number }).status : 0;
    if (status === 422) {
      console.log(`[webhook] Webhook already exists for ${repoFullName}`);
      return null;
    }
    console.warn(`[webhook] Failed to create webhook for ${repoFullName}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

export async function deleteRepoWebhook(
  accessToken: string,
  repoFullName: string,
  webhookId: number
): Promise<void> {
  const octokit = getUserOctokit(accessToken);
  const [owner, repo] = repoFullName.split("/");

  try {
    await octokit.repos.deleteWebhook({ owner, repo, hook_id: webhookId });
    console.log(`[webhook] Deleted webhook ${webhookId} for ${repoFullName}`);
  } catch {
    console.warn(`[webhook] Failed to delete webhook ${webhookId} for ${repoFullName}`);
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");
  return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
