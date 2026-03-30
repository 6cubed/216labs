import type { CSSProperties } from "react";
import Link from "next/link";

const card: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "1.1rem 1.25rem",
  background: "rgba(255,255,255,0.03)",
};

export default function Page() {
  return (
    <main style={{ maxWidth: 820, margin: "0 auto", padding: "2.5rem 1.25rem 4rem" }}>
      <p style={{ margin: 0, fontSize: 13, letterSpacing: "0.12em", textTransform: "uppercase", color: "#7a8499" }}>
        Agentic commerce play
      </p>
      <h1 style={{ margin: "0.35rem 0 0", fontSize: "2.15rem", fontWeight: 800, letterSpacing: "-0.03em" }}>AgentCart</h1>
      <p style={{ margin: "1rem 0 0", color: "#aeb6c9", fontSize: "1.05rem" }}>
        A tiny demo merchant for the world where <strong style={{ color: "#f2f4f8" }}>software buyers are agents</strong>
        — not humans clicking through carts. Structured JSON beats fragile browser automation; checkout is an API; policies are
        machine-readable.
      </p>
      <p style={{ margin: "0.75rem 0 0", color: "#8b95ab", fontSize: 15 }}>
        Inspired by{" "}
        <a href="https://www.educatingsilicon.com/2026/03/30/selling-to-agents/" style={{ color: "#8ab4ff" }}>
          Selling to Agents
        </a>{" "}
        (Educating Silicon). No real payments — demo only.
      </p>

      <section style={{ marginTop: "2rem", display: "grid", gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#c5ccdc" }}>For autonomous buyers</h2>
        <div style={{ display: "grid", gap: 10 }}>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Discovery</div>
            <code style={{ fontSize: 13, color: "#9dd3ff" }}>/.well-known/agent-commerce.json</code>
            <div style={{ marginTop: 8, fontSize: 14, color: "#9aa3b5" }}>Entry point linking catalog, policies, checkout.</div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Catalog</div>
            <Link href="/api/agent/catalog" style={{ color: "#8ab4ff", fontSize: 14 }}>
              GET /api/agent/catalog
            </Link>
            <div style={{ marginTop: 8, fontSize: 14, color: "#9aa3b5" }}>
              SKUs, prices, <code>integrationNotes</code>, <code>verifiableClaims</code> for RAG-friendly retrieval.
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Policies</div>
            <Link href="/api/agent/policies" style={{ color: "#8ab4ff", fontSize: 14 }}>
              GET /api/agent/policies
            </Link>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Checkout (demo)</div>
            <code style={{ fontSize: 13, color: "#9dd3ff" }}>POST /api/agent/checkout</code>
            <pre
              style={{
                margin: "10px 0 0",
                padding: "0.75rem 1rem",
                borderRadius: 10,
                background: "#07090d",
                border: "1px solid rgba(255,255,255,0.08)",
                fontSize: 12,
                overflow: "auto",
                color: "#c8d0e0",
              }}
            >
{`{
  "sku": "STRUCT-DATA-STARTER",
  "quantity": 1,
  "idempotencyKey": "your-uuid-here",
  "buyerRef": "optional-correlation-id"
}`}
            </pre>
            <div style={{ marginTop: 8, fontSize: 13, color: "#7a8499" }}>
              Set <code style={{ color: "#aeb6c9" }}>AGENTCART_API_KEY</code> on the server to require{" "}
              <code style={{ color: "#aeb6c9" }}>Authorization: Bearer …</code>.
            </div>
          </div>
          <div style={card}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>LLM hint file</div>
            <Link href="/llms.txt" style={{ color: "#8ab4ff", fontSize: 14 }}>
              GET /llms.txt
            </Link>
          </div>
        </div>
      </section>

      <section style={{ marginTop: "2.25rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.05rem", color: "#c5ccdc" }}>Why this exists</h2>
        <ul style={{ margin: "0.75rem 0 0", paddingLeft: "1.2rem", color: "#9aa3b5" }}>
          <li>Agents are unreliable at multi-step web checkout; APIs are closer to “perfect” for them.</li>
          <li>Commerce needs explicit auth/payment/delegation stories — sketched in <code>/api/agent/policies</code>.</li>
          <li>Structured, verifiable snippets help your offer land in an agent’s consideration set (training / RAG / tools).</li>
        </ul>
      </section>
    </main>
  );
}
