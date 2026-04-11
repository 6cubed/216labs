import { NextResponse } from "next/server";
import { ensureDataDir, listSessionsMeta, readSession, writeSession } from "@/lib/sessions";
import type { Session } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureDataDir();
  const sessions = await listSessionsMeta();
  return NextResponse.json({ sessions });
}

export async function POST() {
  await ensureDataDir();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const session: Session = {
    id,
    title: "New chat",
    messages: [],
    updatedAt: now,
  };
  await writeSession(session);
  return NextResponse.json({ id });
}
