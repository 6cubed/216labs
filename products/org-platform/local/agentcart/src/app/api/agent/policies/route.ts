import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    {
      schema: "agentcart.policies.v1",
      disclaimer: "Illustrative only—not legal advice; demo store.",
      authentication: {
        catalog: "none",
        policies: "none",
        checkout:
          "Optional Bearer token when AGENTCART_API_KEY is set on the server; otherwise open demo.",
      },
      payments: {
        mode: "demo",
        capture: "none",
        note: "No card or bank data is processed. Orders are in-memory and ephemeral.",
      },
      liability: {
        agentBinding:
          "Demo assumes the caller is authorized to place orders on behalf of an end user; real merchants need explicit human/agent delegation policies.",
      },
      rateLimits: {
        note: "No rate limit in this demo; production should add token buckets per API key.",
      },
      structuredDataPreference:
        "Prefer JSON endpoints over HTML parsing for reliability (per 'Selling to Agents' thesis).",
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
