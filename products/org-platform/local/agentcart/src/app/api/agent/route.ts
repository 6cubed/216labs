import { publicBaseUrl } from "@/lib/base-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const base = publicBaseUrl(request);
  return NextResponse.json(
    {
      name: "AgentCart",
      version: "0.1.0",
      description:
        "Demo merchant optimized for autonomous software buyers—structured catalog, policies, and JSON checkout.",
      inspiredBy: "https://www.educatingsilicon.com/2026/03/30/selling-to-agents/",
      endpoints: {
        discovery: `${base}/.well-known/agent-commerce.json`,
        catalog: `${base}/api/agent/catalog`,
        policies: `${base}/api/agent/policies`,
        checkout: { method: "POST", url: `${base}/api/agent/checkout` },
      },
      humanDocs: base + "/",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
