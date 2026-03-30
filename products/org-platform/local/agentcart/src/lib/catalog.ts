export type AgentProduct = {
  sku: string;
  name: string;
  description: string;
  price: number;
  currency: "USD";
  inStock: boolean;
  category: string;
  /** Hints for autonomous buyers (APIs, webhooks, SLAs). */
  integrationNotes: string[];
  /** Short, checkable statements (demo — not legally binding). */
  verifiableClaims: string[];
};

export const CATALOG: AgentProduct[] = [
  {
    sku: "STRUCT-DATA-STARTER",
    name: "Structured product feed export",
    description:
      "JSON Schema–aligned catalog slice with stable SKUs, prices, and stock flags—optimized for agent parsing over HTML scraping.",
    price: 49,
    currency: "USD",
    inStock: true,
    category: "data",
    integrationNotes: [
      "GET /api/agent/catalog returns application/json; no cookies required.",
      "Each item includes integrationNotes and verifiableClaims for RAG-friendly snippets.",
    ],
    verifiableClaims: [
      "Catalog endpoint responds with Cache-Control: public, max-age=60.",
      "All prices are integer USD in this demo store.",
    ],
  },
  {
    sku: "CHECKOUT-JSON",
    name: "Machine checkout (demo)",
    description:
      "POST a JSON body to place a demo order. Supports idempotency keys—closer to how terminal/API agents shop than form posts.",
    price: 0,
    currency: "USD",
    inStock: true,
    category: "api",
    integrationNotes: [
      "POST /api/agent/checkout with { sku, quantity?, idempotencyKey?, buyerRef? }.",
      "Optional AGENTCART_API_KEY env enforces Authorization: Bearer on checkout.",
    ],
    verifiableClaims: [
      "No real payment is captured; order IDs are demo-only.",
      "Idempotent: repeat POST with same idempotencyKey returns the same orderId.",
    ],
  },
  {
    sku: "POLICY-PACK",
    name: "Agent commerce policy stub",
    description:
      "Plain JSON describing auth, liability, and rate limits—so buyers can reason before purchasing.",
    price: 0,
    currency: "USD",
    inStock: true,
    category: "policy",
    integrationNotes: ["GET /api/agent/policies for machine-readable terms outline."],
    verifiableClaims: [
      "Policies are illustrative; not legal advice.",
      "Human-readable summary also on the site root.",
    ],
  },
];

export function getProduct(sku: string): AgentProduct | undefined {
  return CATALOG.find((p) => p.sku === sku);
}
