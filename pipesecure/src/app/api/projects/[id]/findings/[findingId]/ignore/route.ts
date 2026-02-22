import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, findingId } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const finding = await prisma.finding.findFirst({
    where: { id: findingId, projectId: id },
  });

  if (!finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const reason = body.reason || null;

  const fingerprint = createHash("sha256")
    .update([finding.tool, finding.ruleId || "", finding.filePath || "", finding.title].join("::"))
    .digest("hex")
    .slice(0, 32);

  await prisma.finding.update({
    where: { id: findingId },
    data: {
      ignored: true,
      ignoredAt: new Date(),
      ignoredBy: session.user.id,
      ignoreReason: reason,
    },
  });

  await prisma.ignoredRule.upsert({
    where: { projectId_fingerprint: { projectId: id, fingerprint } },
    update: { reason, ignoredBy: session.user.id },
    create: {
      projectId: id,
      fingerprint,
      reason,
      ignoredBy: session.user.id,
    },
  });

  return NextResponse.json({ ignored: true, fingerprint });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; findingId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, findingId } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: session.user.id },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const finding = await prisma.finding.findFirst({
    where: { id: findingId, projectId: id },
  });

  if (!finding) {
    return NextResponse.json({ error: "Finding not found" }, { status: 404 });
  }

  const fingerprint = createHash("sha256")
    .update([finding.tool, finding.ruleId || "", finding.filePath || "", finding.title].join("::"))
    .digest("hex")
    .slice(0, 32);

  await prisma.finding.update({
    where: { id: findingId },
    data: { ignored: false, ignoredAt: null, ignoredBy: null, ignoreReason: null },
  });

  await prisma.ignoredRule.deleteMany({
    where: { projectId: id, fingerprint },
  });

  return NextResponse.json({ restored: true });
}
