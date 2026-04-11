import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { readSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const session = await readSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const session = await readSession(id);
  if (!session) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const dir = process.env.LLMSEARCH_DATA_DIR?.trim() || path.join(process.cwd(), "data");
  const file = path.join(dir, "sessions", `${id}.json`);
  try {
    await fs.unlink(file);
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
