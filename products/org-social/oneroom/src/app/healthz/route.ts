import { NextResponse } from "next/server";

/** Fast path for activator / Caddy readiness (no auth, minimal work). */
export async function GET() {
  return NextResponse.json({ ok: true }, { status: 200 });
}
