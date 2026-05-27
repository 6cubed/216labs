import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getOrgMetrics } from "@/lib/org-metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const metrics = getOrgMetrics(db);
  return NextResponse.json(metrics, { headers: { "Cache-Control": "no-store" } });
}

