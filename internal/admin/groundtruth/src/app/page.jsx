import Link from "next/link";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main>
      <h1 style={{ fontSize: "1.9rem", marginBottom: "0.5rem" }}>216Labs Groundtruth</h1>
      <p className="muted">
        Human-in-the-loop data labeling with dedicated requester and labeller experiences.
      </p>
      <section className="section grid two" style={{ marginTop: "1.25rem" }}>
        <Link href="/requester" className="linkCard">
          <h2 style={{ fontSize: "1.1rem" }}>Requester flow</h2>
          <p className="muted" style={{ marginTop: "0.45rem" }}>
            Create image datasets, define label schema, and publish labeling tasks.
          </p>
        </Link>
        <Link href="/labeller" className="linkCard">
          <h2 style={{ fontSize: "1.1rem" }}>Labeller flow</h2>
          <p className="muted" style={{ marginTop: "0.45rem" }}>
            Pull open tasks and submit per-image labels against requester instructions.
          </p>
        </Link>
      </section>
    </main>
  );
}
