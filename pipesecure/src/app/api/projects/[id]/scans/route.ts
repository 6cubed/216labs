import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getScanQueue } from "@/lib/queue";
import type { InitialScanJob } from "@/lib/queue";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scans = await prisma.scan.findMany({
    where: { projectId: id },
    include: {
      _count: { select: { findings: true } },
      findings: {
        select: { severity: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const result = scans.map((scan) => {
    const severityCounts = scan.findings.reduce(
      (acc, f) => {
        acc[f.severity] = (acc[f.severity] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    return {
      ...scan,
      findings: undefined,
      severityCounts,
    };
  });

  return NextResponse.json(result);
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const running = await prisma.scan.findFirst({
    where: { projectId: id, status: { in: ["queued", "running"] } },
  });

  if (running) {
    return NextResponse.json({ error: "A scan is already in progress" }, { status: 409 });
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
    repoFullName: project.githubRepoFullName,
    branch: project.defaultBranch,
    scanId: scan.id,
  };

  await getScanQueue().add("initial-scan", jobData, {
    jobId: `rescan-${scan.id}`,
  });

  return NextResponse.json({ scanId: scan.id }, { status: 201 });
}
