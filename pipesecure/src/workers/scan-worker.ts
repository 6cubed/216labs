import { createHash } from "crypto";
import { prisma } from "../lib/db";
import { decrypt } from "../lib/encryption";
import { cloneRepo, cloneRepoWithInstallation, cleanupRepo } from "../lib/github";
import { runAgentScan } from "./agent/orchestrator";
import { lookupCVEs } from "./agent/tools/cve-lookup";
import { parseDependencyManifests } from "./agent/tools/dependency-parser";
import type { ScanFinding } from "./agent/types";
import type { InitialScanJob, CommitScanJob } from "../lib/queue";

function fingerprintFinding(f: ScanFinding): string {
  const key = [f.tool, f.ruleId || "", f.filePath || "", f.title].join("::");
  return createHash("sha256").update(key).digest("hex").slice(0, 32);
}

async function getUserOpenAIKey(userId: string): Promise<string | null> {
  const apiKey = await prisma.apiKey.findFirst({
    where: { userId, provider: "openai" },
    orderBy: { createdAt: "desc" },
  });
  if (!apiKey) return null;
  try {
    return decrypt(apiKey.encryptedKey);
  } catch {
    return null;
  }
}

async function getCloneToken(userId: string): Promise<string | null> {
  const account = await prisma.account.findFirst({
    where: { userId, provider: "github" },
    select: { access_token: true },
  });
  if (account?.access_token) return account.access_token;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { githubAccessToken: true },
  });
  return user?.githubAccessToken || null;
}

async function cloneRepository(
  repoFullName: string,
  branch: string,
  userId: string,
  installationId?: number
): Promise<string> {
  if (installationId && installationId > 0) {
    try {
      console.log(`[clone] Trying installation token (${installationId}) for ${repoFullName}`);
      return await cloneRepoWithInstallation(repoFullName, installationId, branch);
    } catch (error) {
      console.warn(`[clone] Installation token failed, falling back to user token:`, error instanceof Error ? error.message : error);
    }
  }

  const token = await getCloneToken(userId);
  if (!token) {
    throw new Error("No GitHub access token available — user must re-authenticate");
  }

  console.log(`[clone] Using user OAuth token for ${repoFullName}`);
  return await cloneRepo(repoFullName, token, branch);
}

async function executeScan(params: {
  scanId: string;
  projectId: string;
  userId: string;
  repoFullName: string;
  branch: string;
  commitSha?: string;
  installationId?: number;
}) {
  const { scanId, projectId, userId, repoFullName, branch, commitSha, installationId } = params;

  await prisma.scan.update({
    where: { id: scanId },
    data: { status: "running", startedAt: new Date() },
  });

  let repoPath: string | null = null;

  try {
    const scanExists = await prisma.scan.findUnique({ where: { id: scanId }, select: { id: true } });
    if (!scanExists) {
      console.warn(`[scan] Scan ${scanId} no longer exists (project likely deleted), aborting`);
      return;
    }

    const openaiKey = await getUserOpenAIKey(userId);

    repoPath = await cloneRepository(repoFullName, branch, userId, installationId);

    const agentFindings = await runAgentScan({
      repoPath,
      repoFullName,
      commitSha,
      openaiApiKey: openaiKey,
    });

    const deps = await parseDependencyManifests(repoPath);
    const cveFindings = deps.length > 0 ? await lookupCVEs(deps) : [];

    const allFindings = [...agentFindings, ...cveFindings];

    const ignoredRules = await prisma.ignoredRule.findMany({
      where: { projectId },
      select: { fingerprint: true },
    });
    const ignoredSet = new Set(ignoredRules.map((r) => r.fingerprint));

    const activeFindings = allFindings.filter((f) => !ignoredSet.has(fingerprintFinding(f)));
    const ignoredCount = allFindings.length - activeFindings.length;
    if (ignoredCount > 0) {
      console.log(`[scan] Filtered out ${ignoredCount} ignored findings`);
    }

    const stillExists = await prisma.scan.findUnique({ where: { id: scanId }, select: { id: true } });
    if (!stillExists) {
      console.warn(`[scan] Scan ${scanId} was deleted during execution, discarding results`);
      return;
    }

    if (activeFindings.length > 0) {
      await prisma.finding.createMany({
        data: activeFindings.map((f) => ({
          scanId,
          projectId,
          severity: f.severity,
          type: f.type,
          title: f.title,
          description: f.description,
          filePath: f.filePath || null,
          startLine: f.startLine || null,
          endLine: f.endLine || null,
          cweId: f.cweId || null,
          cveId: f.cveId || null,
          cvssScore: f.cvssScore || null,
          cvssVector: f.cvssVector || null,
          tool: f.tool,
          ruleId: f.ruleId || null,
          confidence: f.confidence || null,
          rawData: f.rawData ? JSON.parse(JSON.stringify(f.rawData)) : undefined,
        })),
      });
    }

    const severityCounts = activeFindings.reduce(
      (acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        completedAt: new Date(),
        summary: {
          totalFindings: activeFindings.length,
          ignoredFindings: ignoredCount,
          severityCounts,
        },
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { lastScannedAt: new Date() },
    });

    console.log(`[scan] Completed scan ${scanId}: ${activeFindings.length} findings (${ignoredCount} ignored)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[scan] Failed scan ${scanId}:`, message);

    try {
      await prisma.scan.update({
        where: { id: scanId },
        data: {
          status: "failed",
          completedAt: new Date(),
          errorMessage: message,
        },
      });
    } catch {
      console.warn(`[scan] Could not mark scan ${scanId} as failed (record may have been deleted)`);
    }
  } finally {
    if (repoPath) {
      await cleanupRepo(repoPath);
    }
  }
}

export async function handleInitialScan(job: InitialScanJob) {
  const project = await prisma.project.findUnique({
    where: { id: job.projectId },
    select: { githubInstallationId: true },
  });

  await executeScan({
    scanId: job.scanId,
    projectId: job.projectId,
    userId: job.userId,
    repoFullName: job.repoFullName,
    branch: job.branch,
    installationId: project?.githubInstallationId || undefined,
  });
}

export async function handleCommitScan(job: CommitScanJob) {
  await executeScan({
    scanId: job.scanId,
    projectId: job.projectId,
    userId: job.userId,
    repoFullName: job.repoFullName,
    branch: job.branch,
    commitSha: job.commitSha,
    installationId: job.installationId,
  });
}
