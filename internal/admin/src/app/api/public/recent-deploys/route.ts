import { NextResponse } from "next/server";
import { getRecentDeploymentActivity } from "@/lib/db";
import { buildRecentActivityFeed } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

/**
 * Public read-only feed of recent app deployments (no secrets).
 * Used by the www landing page; excludes admin dashboard deploys.
 */
export async function GET() {
  const rows = getRecentDeploymentActivity(40).filter((row) => row.id !== "admin");
  const items = buildRecentActivityFeed(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      lastDeployedAt: row.last_deployed_at,
    })),
  ).slice(0, 20);

  return NextResponse.json(
    {
      items: items.map((item) => ({
        id: item.appId,
        name: item.appName,
        lastDeployedAt: item.deployedAtRaw,
        host: item.host,
        url: item.url,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
