import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/github";
import { prisma } from "@/lib/db";
import { getScanQueue } from "@/lib/queue";
import type { CommitScanJob } from "@/lib/queue";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  const event = request.headers.get("x-github-event");

  if (!signature || !process.env.GITHUB_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const isValid = verifyWebhookSignature(body, signature, process.env.GITHUB_WEBHOOK_SECRET);
  if (!isValid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const payload = JSON.parse(body);

  if (event === "push") {
    return handlePushEvent(payload);
  }

  if (event === "installation" || event === "installation_repositories") {
    return handleInstallationEvent(payload);
  }

  return NextResponse.json({ received: true });
}

async function handlePushEvent(payload: {
  repository: { full_name: string };
  after: string;
  ref: string;
  installation?: { id: number };
}) {
  const repoFullName = payload.repository.full_name;
  const commitSha = payload.after;
  const branch = payload.ref.replace("refs/heads/", "");
  const installationId = payload.installation?.id;

  const project = await prisma.project.findFirst({
    where: { githubRepoFullName: repoFullName, status: "active" },
  });

  if (!project) {
    return NextResponse.json({ skipped: true, reason: "project not found" });
  }

  const scan = await prisma.scan.create({
    data: {
      projectId: project.id,
      type: "commit",
      commitSha,
      branch,
      status: "queued",
    },
  });

  const jobData: CommitScanJob = {
    projectId: project.id,
    userId: project.userId,
    repoFullName,
    commitSha,
    branch,
    scanId: scan.id,
    installationId: installationId || project.githubInstallationId || 0,
  };

  await getScanQueue().add("commit-scan", jobData, {
    jobId: `commit-${scan.id}`,
  });

  return NextResponse.json({ queued: true, scanId: scan.id });
}

async function handleInstallationEvent(payload: {
  action: string;
  installation: { id: number; account: { login: string } };
  repositories?: Array<{ full_name: string }>;
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
}) {
  const installationId = payload.installation.id;

  if (payload.action === "deleted") {
    await prisma.project.updateMany({
      where: { githubInstallationId: installationId },
      data: { githubInstallationId: null, status: "disconnected" },
    });
  }

  if (payload.repositories_added) {
    for (const repo of payload.repositories_added) {
      await prisma.project.updateMany({
        where: { githubRepoFullName: repo.full_name },
        data: { githubInstallationId: installationId },
      });
    }
  }

  if (payload.repositories_removed) {
    for (const repo of payload.repositories_removed) {
      await prisma.project.updateMany({
        where: { githubRepoFullName: repo.full_name },
        data: { githubInstallationId: null },
      });
    }
  }

  return NextResponse.json({ received: true });
}
