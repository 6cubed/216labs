import { publicBaseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

/** Plain-text hints for LLM crawlers / tool-using agents. */
export async function GET(request: Request) {
  const base = publicBaseUrl(request);
  const body = `# AgentCart

Demo store built around "selling to agents" — machine-readable commerce instead of brittle checkout automation in a browser.

Primary JSON:
- ${base}/api/agent — index
- ${base}/api/agent/catalog — products (SKUs, prices, integrationNotes, verifiableClaims)
- ${base}/api/agent/policies — auth/payment/liability outline (demo)
- POST ${base}/api/agent/checkout — place demo order { "sku", "quantity?", "idempotencyKey?", "buyerRef?" }

Discovery:
- ${base}/.well-known/agent-commerce.json

Inspiration: https://www.educatingsilicon.com/2026/03/30/selling-to-agents/

No real payments. Optional Bearer AGENTCART_API_KEY on checkout when configured server-side.
`;
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
