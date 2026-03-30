import { publicBaseUrl } from "@/lib/base-url";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Discovery document for autonomous buyers — similar in spirit to robots.txt / security.txt,
 * but aimed at commerce agents.
 */
export async function GET(request: Request) {
  const base = publicBaseUrl(request);
  return NextResponse.json(
    {
      schemaId: "agentcart.agent-commerce-discovery.v1",
      name: "AgentCart",
      version: "0.1.0",
      merchantType: "demo",
      apis: {
        index: `${base}/api/agent`,
        catalog: `${base}/api/agent/catalog`,
        policies: `${base}/api/agent/policies`,
        checkout: {
          url: `${base}/api/agent/checkout`,
          method: "POST",
          contentType: "application/json",
        },
      },
      preferences: {
        dataFormat: ["application/json"],
        humanLanding: base,
        notes: [
          "Inspired by Educating Silicon — Selling to Agents (2026-03-30).",
          "Prefer these JSON endpoints over headless browsing for reliable purchasing flows.",
        ],
      },
    },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
