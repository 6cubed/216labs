function getAppHost(): string {
  return process.env.NEXT_PUBLIC_APP_HOST?.trim() || "6cubed.app";
}

function getContactEmail(host: string): string {
  const fromEnv = process.env.VC_CONTACT_EMAIL?.trim();
  if (fromEnv) return fromEnv;
  return `vc@${host}`;
}

export default function Page() {
  const host = getAppHost();
  const contact = getContactEmail(host);
  const rootUrl = `https://${host}`;

  return (
    <main className="page">
      <p className="badge">216 Labs · Venture capital</p>
      <h1>We back builders who ship.</h1>
      <p className="lead">
        216 Labs Ventures is the investment arm of 216 Labs. We partner with founders building durable product—software,
        tools, and media—with an emphasis on execution, craft, and production-grade delivery.
      </p>

      <section>
        <h2>What we look for</h2>
        <p>
          Teams with a clear point of view, early evidence of demand, and the discipline to iterate in public. We
          care about architecture and ops as much as narrative: systems that scale, teams that own outcomes.
        </p>
      </section>

      <section>
        <h2>How we work</h2>
        <p>
          Straightforward terms, fast feedback, and access to the same monorepo, deploy, and tooling culture we use
          across the portfolio. We are hands-on when it helps and out of the way when it does not.
        </p>
      </section>

      <div className="card">
        <p>
          <strong>Founders:</strong> introduce yourself at{" "}
          <a className="contact-email" href={`mailto:${contact}`}>
            {contact}
          </a>
          . A short note on what you are building and where you are based is enough to start.
        </p>
      </div>

      <footer className="footer">
        Part of{" "}
        <a href={rootUrl} rel="noreferrer">
          216 Labs
        </a>
        . This site lives at <code>vc.{host}</code>.
      </footer>
    </main>
  );
}
