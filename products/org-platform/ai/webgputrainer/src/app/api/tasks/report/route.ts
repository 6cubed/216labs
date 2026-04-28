import { NextResponse } from "next/server";
import { authenticateWorker, reportTask, heartbeat } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const w = await authenticateWorker(req);
  if (!w) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  await heartbeat(w.id);

  const body = (await req.json().catch(() => ({}))) as {
    taskId?: string;
    ok?: boolean;
    result?: Record<string, unknown>;
    error?: string;
  };
  if (!body.taskId) {
    return NextResponse.json({ ok: false, error: "missing_taskId" }, { status: 400 });
  }

  try {
    const t = await reportTask({
      taskId: body.taskId,
      workerId: w.id,
      ok: !!body.ok,
      result: body.result,
      error: body.error,
    });
    return NextResponse.json({ ok: true, task: t });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "report_failed" },
      { status: 400 },
    );
  }
}

