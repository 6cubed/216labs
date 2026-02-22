import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScanQueue } from "@/lib/queue";
import { createRepoWebhook } from "@/lib/github";
import type { InitialScanJob } from "@/lib/queue";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    include: {
      _count: { select: { scans: true, findings: true } },
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, type: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { repoFullName, defaultBranch, installationId } = body;

  if (!repoFullName) {
    return NextResponse.json({ error: "repoFullName is required" }, { status: 400 });
  }

  const existing = await prisma.project.findFirst({
    where: { userId: session.user.id, githubRepoFullName: repoFullName },
  });

  if (existing) {
    return NextResponse.json({ error: "Project already exists" }, { status: 409 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
    select: { access_token: true },
  });

  const project = await prisma.project.create({
    data: {
      userId: session.user.id,
      name: repoFullName.split("/")[1],
      githubRepoFullName: repoFullName,
      githubInstallationId: installationId || null,
      defaultBranch: defaultBranch || "main",
    },
  });

  if (account?.access_token) {
    const webhookId = await createRepoWebhook(account.access_token, repoFullName);
    if (webhookId) {
      await prisma.project.update({
        where: { id: project.id },
        data: { githubWebhookId: webhookId },
      });
    }
  }

  const scan = await prisma.scan.create({
    data: {
      projectId: project.id,
      type: "initial",
      branch: project.defaultBranch,
      status: "queued",
    },
  });

  const jobData: InitialScanJob = {
    projectId: project.id,
    userId: session.user.id,
    repoFullName,
    branch: project.defaultBranch,
    scanId: scan.id,
  };

  await getScanQueue().add("initial-scan", jobData, {
    jobId: `initial-${scan.id}`,
  });

  return NextResponse.json({ project, scanId: scan.id }, { status: 201 });
}
