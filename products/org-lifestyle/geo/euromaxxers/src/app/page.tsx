import { euromaxxerScore, euromaxxers } from "@/lib/euromaxxers";

const cardStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, #16203f 0%, #101a35 100%)",
  border: "1px solid #31416d",
  borderRadius: 12,
  padding: "1rem",
};

function networkEdges() {
  const nodes = euromaxxers.map((x, index) => ({
    id: x.id,
    label: x.name,
    x: 130 + index * 210,
    y: 90 + (index % 2 === 0 ? 0 : 70),
  }));

  const edges: Array<{ from: string; to: string }> = [];
  for (const person of euromaxxers) {
    for (const target of person.crossLinkedTo) {
      const hasInverse = euromaxxers
        .find((candidate) => candidate.id === target)
        ?.crossLinkedTo.includes(person.id);
      if (hasInverse || person.id < target) {
        edges.push({ from: person.id, to: target });
      }
    }
  }

  return { nodes, edges };
}

export default function Page() {
  const ranked = [...euromaxxers].sort((a, b) => euromaxxerScore(b) - euromaxxerScore(a));
  const network = networkEdges();

  return (
    <main style={{ padding: "2rem", maxWidth: 1120, margin: "0 auto" }}>
      <h1 style={{ marginTop: 0, fontSize: "2rem" }}>Euromaxxers</h1>
      <p style={{ color: "#cbd6f6", maxWidth: 920 }}>
        Curated index of world-class euromaxxers and how they relate on Wikipedia. Scores are directional and
        transparent: transnational breadth, long-term commitment, network density, mobility orientation, and
        institutional impact, with a small penalty for stronger domestic attachment.
      </p>

      <section style={{ marginTop: "1.5rem", ...cardStyle }}>
        <h2 style={{ marginTop: 0 }}>Network snapshot</h2>
        <svg viewBox="0 0 620 220" style={{ width: "100%", height: "auto", background: "#0c1530", borderRadius: 8 }}>
          {network.edges.map((edge) => {
            const from = network.nodes.find((n) => n.id === edge.from);
            const to = network.nodes.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#7f95d8"
                strokeWidth="2"
              />
            );
          })}
          {network.nodes.map((node) => (
            <g key={node.id}>
              <circle cx={node.x} cy={node.y} r="24" fill="#2d427a" stroke="#9db0e7" strokeWidth="2" />
              <text x={node.x} y={node.y + 44} textAnchor="middle" fill="#eaf0ff" fontSize="13">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </section>

      <section style={{ marginTop: "1rem", display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {ranked.map((person) => (
          <article key={person.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>{person.name}</h3>
              <span
                style={{
                  fontSize: "0.82rem",
                  border: "1px solid #5f77ba",
                  borderRadius: 999,
                  padding: "0.2rem 0.6rem",
                  color: "#dce6ff",
                }}
              >
                Score: {euromaxxerScore(person)}
              </span>
            </div>
            <p style={{ color: "#c7d3f8" }}>{person.shortBio}</p>
            <p style={{ marginBottom: "0.4rem", color: "#9fb0de", fontSize: "0.9rem" }}>
              Strong ties: {person.countriesStrongTie.join(", ")}
            </p>
            <p style={{ marginTop: 0, color: "#9fb0de", fontSize: "0.9rem" }}>
              Linked euromaxxers:{" "}
              {person.crossLinkedTo
                .map((id) => euromaxxers.find((x) => x.id === id)?.name ?? id)
                .join(", ") || "None yet"}
            </p>
            <a href={person.wikipediaUrl} target="_blank" rel="noreferrer" style={{ color: "#a9c8ff" }}>
              Open Wikipedia profile
            </a>
          </article>
        ))}
      </section>
    </main>
  );
}
