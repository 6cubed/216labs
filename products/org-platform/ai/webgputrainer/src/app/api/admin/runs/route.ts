import { NextResponse } from "next/server";
import { createRun, isAdminAuthorized, listRuns } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ ok: true, runs });
}

export async function POST(req: Request) {
  if (!isAdminAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    config?: Record<string, unknown>;
  };
  const name = (body.name || "").trim();
  if (!name) return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  const run = await createRun({ name, config: body.config });
  return NextResponse.json({ ok: true, run });
}

