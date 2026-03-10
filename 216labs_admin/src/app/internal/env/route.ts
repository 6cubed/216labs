import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Internal-only endpoint for apps in the Docker network to read their env vars.
 * Not exposed via Caddy — only reachable at http://admin:3000/internal/env
 *
 * GET /internal/env?key=MYAPP_OPENAI_API_KEY
 * → { "value": "sk-..." }  or  { "value": "" }  if not set
 */
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key parameter required" }, { status: 400 });
  }

  const row = getDb()
    .prepare("SELECT value FROM env_vars WHERE key = ? LIMIT 1")
    .get(key) as { value: string } | undefined;

  return NextResponse.json({ value: row?.value ?? "" });
}
