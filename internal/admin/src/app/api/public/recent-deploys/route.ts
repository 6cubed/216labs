import { NextResponse } from "next/server";
import { getUnifiedDeploymentFeed } from "@/lib/deployment-feed";

export const dynamic = "force-dynamic";

/**
 * Public read-only feed: VPS + CI + app rollouts (no secrets).
 * Landing pages can show recent shipping activity without basic auth.
 */
export async function GET() {
  const all = await getUnifiedDeploymentFeed(24);
  const items = all.filter(
    (i) =>
      i.channel !== "snapshot" ||
      (i.appId && i.appId !== "admin"),
  );

  return NextResponse.json(
    {
      items: items.map((item) => ({
        id: item.id,
        channel: item.channel,
        headline: item.headline,
        detail: item.detail,
        occurredAt: new Date(item.occurredAtMs).toISOString(),
        appId: item.appId ?? null,
        url: item.href ?? null,
      })),
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
