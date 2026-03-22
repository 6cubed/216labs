import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Public read-only feed of recent app deployments (no secrets).
 * Used by the www landing page; excludes admin dashboard deploys.
 */
export async function GET() {
  const rows = getDb()
    .prepare(
      `SELECT id, name, last_deployed_at
       FROM apps
       WHERE id != 'admin'
         AND last_deployed_at IS NOT NULL
         AND TRIM(last_deployed_at) != ''
       ORDER BY last_deployed_at DESC
       LIMIT 20`,
    )
    .all() as { id: string; name: string; last_deployed_at: string }[];

  const appHost = process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app";
  const items = rows.map((r) => ({
    id: r.id,
    name: r.name,
    lastDeployedAt: r.last_deployed_at,
    host: `${r.id}.${appHost}`,
    url: `https://${r.id}.${appHost}`,
  }));

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
