import { NextResponse } from "next/server";
import { enqueueTasks, isAdminAuthorized } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    runId?: string;
    kind?: string;
    tasks?: Array<{ payload?: Record<string, unknown> }>;
  };
  const runId = (body.runId || "").trim();
  const kind = (body.kind || "").trim() || "noop";
  const tasks = Array.isArray(body.tasks) ? body.tasks : [];
  if (!runId) return NextResponse.json({ ok: false, error: "missing_runId" }, { status: 400 });
  if (!tasks.length) return NextResponse.json({ ok: false, error: "missing_tasks" }, { status: 400 });

  try {
    const res = await enqueueTasks({
      runId,
      kind,
      tasks: tasks.map((t) => ({ payload: t.payload ?? {} })),
    });
    return NextResponse.json({ ok: true, ...res });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "enqueue_failed" },
      { status: 400 },
    );
  }
}

