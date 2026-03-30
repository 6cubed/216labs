import { CATALOG } from "@/lib/catalog";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      schema: "agentcart.catalog.v1",
      updatedAt: new Date().toISOString(),
      currencyDefault: "USD",
      items: CATALOG,
    },
    { headers: { "Cache-Control": "public, max-age=60" } },
  );
}
