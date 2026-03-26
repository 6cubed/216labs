import { NextResponse } from "next/server";
import { getPublicLiveApps } from "@/lib/db";

export const dynamic = "force-dynamic";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app";

function hostForApp(appId: string): string {
  const host = APP_HOST.trim();
  if (!host || host === "localhost") return `${appId}.6cubed.app`;
  return `${appId}.${host}`;
}

/**
 * Public read-only list of apps with deploy toggled on (live on the VPS).
 * Used by the root-domain landing page.
 */
export async function GET() {
  const rows = getPublicLiveApps();
  const items = rows.map((row) => {
    const host = hostForApp(row.id);
    const tagline = row.tagline?.trim() || "";
    const desc = row.description?.trim() || "";
    return {
      id: row.id,
      name: row.name,
      tagline: tagline || desc,
      host,
      url: `https://${host}`,
    };
  });

  return NextResponse.json(
    { items },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
      },
    },
  );
}
