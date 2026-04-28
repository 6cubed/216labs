import { NextResponse } from "next/server";
import { authenticateWorker, claimNextTask, heartbeat } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const w = await authenticateWorker(req);
  if (!w) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await heartbeat(w.id);
  const task = await claimNextTask(w.id);
  return NextResponse.json({ ok: true, task });
}

