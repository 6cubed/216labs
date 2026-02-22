import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; scanId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, scanId } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true, githubRepoFullName: true, defaultBranch: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const scan = await prisma.scan.findFirst({
    where: { id: scanId, projectId: id },
    include: {
      findings: {
        orderBy: [
          { severity: "asc" },
          { createdAt: "desc" },
        ],
      },
    },
  });

  if (!scan) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({
    ...scan,
    project: {
      githubRepoFullName: project.githubRepoFullName,
      defaultBranch: project.defaultBranch,
    },
  });
}
