import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteRepoWebhook } from "@/lib/github";
import { getScanQueue } from "@/lib/queue";

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
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          _count: { select: { findings: true } },
        },
      },
      _count: {
        select: {
          findings: {
            where: { severity: { in: ["critical", "high"] } },
          },
        },
      },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function DELETE(
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

  if (project.githubWebhookId) {
    const account = await prisma.account.findFirst({
      where: { userId: session.user.id, provider: "github" },
      select: { access_token: true },
    });
    if (account?.access_token) {
      await deleteRepoWebhook(account.access_token, project.githubRepoFullName, project.githubWebhookId);
    }
  }

  const pendingScans = await prisma.scan.findMany({
    where: { projectId: id, status: { in: ["queued", "running"] } },
    select: { id: true },
  });
  const queue = getScanQueue();
  for (const scan of pendingScans) {
    for (const prefix of ["initial", "rescan", "commit"]) {
      await queue.remove(`${prefix}-${scan.id}`).catch(() => {});
    }
  }

  await prisma.finding.deleteMany({ where: { projectId: id } });
  await prisma.scan.deleteMany({ where: { projectId: id } });
  await prisma.project.delete({ where: { id } });

  return NextResponse.json({ deleted: true });
}
