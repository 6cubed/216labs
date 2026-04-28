import Link from "next/link";

export default async function Home() {
  return (
    <main style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <header style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>WebGPU Trainer</h1>
          <p style={{ marginTop: 8, color: "#555" }}>
            Coordinator for a mesh of browser WebGPU workers. MVP: create runs, enlist workers,
            distribute small tasks.
          </p>
        </div>
        <nav style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/worker">Worker</Link>
          <Link href="/admin">Admin</Link>
        </nav>
      </header>

      <section style={{ marginTop: 24, padding: 16, border: "1px solid #eee", borderRadius: 12 }}>
        <h2 style={{ marginTop: 0 }}>Quick start</h2>
        <ol style={{ color: "#444" }}>
          <li>Open the Worker page on devices with WebGPU.</li>
          <li>From Admin, create a run and enqueue tasks.</li>
          <li>Workers poll / claim tasks, execute, and report results.</li>
        </ol>
      </section>

      <section style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card title="API health" description="Coordinator status and counts." href="/api/status" />
        <Card title="Worker page" description="Connect as a volunteer WebGPU worker." href="/worker" />
      </section>
    </main>
  );
}

function Card({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      style={{
        display: "block",
        padding: 16,
        border: "1px solid #eee",
        borderRadius: 12,
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ fontWeight: 600 }}>{title}</div>
      <div style={{ marginTop: 6, color: "#666" }}>{description}</div>
      <div style={{ marginTop: 10, color: "#111" }}>Open →</div>
    </a>
  );
}

