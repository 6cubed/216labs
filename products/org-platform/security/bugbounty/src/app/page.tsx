function getAppHost(): string {
  return process.env.APP_HOST?.trim() || "6cubed.app";
}

function getSecurityEmail(): string {
  return (
    process.env.BUGBOUNTY_SECURITY_EMAIL?.trim() || "security@6cubed.app"
  );
}

export default function Page() {
  const host = getAppHost();
  const securityEmail = getSecurityEmail();
  const wildcard = `*.${host}`;

  return (
    <main className="wrap">
      <header className="hero">
        <h1>Bug Bounty Program</h1>
        <p className="lead">
          216Labs welcomes good-faith security research against our public application portfolio. This page
          describes scope, rules, safe harbor, and how to report findings.
        </p>
      </header>

      <nav className="toc" aria-label="On this page">
        <a href="#overview">Overview</a>
        <a href="#scope">Scope</a>
        <a href="#out-of-scope">Out of scope</a>
        <a href="#rules">Rules</a>
        <a href="#safe-harbor">Safe harbor</a>
        <a href="#severity">Severity &amp; rewards</a>
        <a href="#reporting">Reporting</a>
        <a href="#response">Response</a>
        <a href="#eligibility">Eligibility</a>
      </nav>

      <section id="overview">
        <h2>Program overview</h2>
        <p>
          We run a <strong>coordinated disclosure</strong> program. Please report vulnerabilities to us first and
          give us reasonable time to remediate before any public disclosure. Do not access, modify, or destroy data
          that does not belong to you; limit impact to what is necessary to demonstrate the issue.
        </p>
        <p>
          This program covers Internet-facing properties we operate for the portfolio hosted under{" "}
          <code>{wildcard}</code>. The list of apps evolves; the canonical entry point is{" "}
          <a href={`https://${host}`}>{host}</a>.
        </p>
      </section>

      <section id="scope">
        <h2>In scope</h2>
        <p>Generally in scope when testing in good faith:</p>
        <ul className="std">
          <li>
            Public web applications and APIs served under <code>{wildcard}</code> as part of the 216Labs production
            deployment (each app subdomain, the root site, and documented public endpoints).
          </li>
          <li>
            Vulnerabilities that affect confidentiality, integrity, or availability of these services or their
            users (e.g. XSS, CSRF where impactful, SSRF, injection, authentication or authorization flaws, sensitive
            data exposure).
          </li>
          <li>
            Misconfiguration that materially increases risk (e.g. open redirects combined with other issues, clear
            exposure of secrets in public responses), assessed case by case.
          </li>
        </ul>
        <h3>Authenticated testing</h3>
        <p>
          If you need an account to validate a report, describe the limitation in your initial email. We may provide
          a test account or guidance where appropriate. Do not use or guess other people&apos;s credentials.
        </p>
      </section>

      <section id="out-of-scope">
        <h2>Out of scope</h2>
        <p>The following are <strong>not</strong> eligible unless we explicitly say otherwise:</p>
        <ul className="std">
          <li>
            <strong>Denial of service</strong> or load testing that degrades production (including application-layer
            floods). Use minimal traffic to confirm a logic bug.
          </li>
          <li>
            <strong>Physical</strong> security, <strong>social engineering</strong> (including phishing support or
            staff), or attacks against our suppliers&apos; employees.
          </li>
          <li>
            <strong>Spam</strong>, mass automated scanning without regard for rate limits, or brute-force / credential
            stuffing against production accounts.
          </li>
          <li>
            Issues in <strong>third-party</strong> services, libraries, or infrastructure we do not control (report
            them to the vendor; we still appreciate a heads-up if it affects us).
          </li>
          <li>
            <strong>UI-only</strong> bugs with no plausible security impact, <strong>missing best-practice</strong>{" "}
            headers without demonstrable exploit, or <strong>self-XSS</strong>.
          </li>
          <li>
            Known-vulnerable dependencies already tracked by our process, or issues we have already triaged as
            duplicates (we will tell you).
          </li>
          <li>
            Content issues (typos, SEO) and <strong>non-security</strong> functional bugs (use normal product channels).
          </li>
        </ul>
        <div className="callout warn">
          <p>
            The admin and internal operations surfaces may require separate coordination. Do not pivot from a finding
            into bulk access of deployment keys, user databases, or infrastructure beyond what is needed for a concise
            proof of concept.
          </p>
        </div>
      </section>

      <section id="rules">
        <h2>Rules of engagement</h2>
        <ul className="std">
          <li>Comply with applicable laws and this policy.</li>
          <li>Minimize harm: no destructive actions, no extortion, no public leaks of user data.</li>
          <li>
            Stop and report if you accidentally encounter highly sensitive data; do not download large datasets to
            &quot;prove&quot; access.
          </li>
          <li>One account per researcher where we issue test credentials; do not share access.</li>
          <li>We may update this page; check the live policy when you test.</li>
        </ul>
      </section>

      <section id="safe-harbor">
        <h2>Safe harbor</h2>
        <div className="callout">
          <p>
            When you act in <strong>good faith</strong> and follow this policy, we will not pursue civil action or
            law-enforcement complaints against you for accidental, policy-conforming research. This does not bind third
            parties and is not a promise of immunity from all legal risk—if you are unsure, consult qualified counsel.
          </p>
          <p>
            We consider good faith to include: proportional testing, prompt reporting, and avoiding privacy violations
            and service disruption as described above.
          </p>
        </div>
      </section>

      <section id="severity">
        <h2>Severity &amp; rewards</h2>
        <p>
          We triage using industry-standard concepts (e.g. CVSS-style impact). Rewards, if any, are{" "}
          <strong>at our discretion</strong>, may vary by impact and exploitability, and can include public recognition
          where you agree. Past rewards do not guarantee future ones.
        </p>
        <table className="rewards" aria-label="Indicative severity tiers">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Examples (non-exhaustive)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Critical</td>
              <td>Remote code execution, systemic auth bypass exposing many accounts, wormable XSS chain with proven impact</td>
            </tr>
            <tr>
              <td>High</td>
              <td>Significant data breach, account takeover at scale, severe SSRF to internal services</td>
            </tr>
            <tr>
              <td>Medium</td>
              <td>Targeted privilege issues, stored XSS with real user impact, meaningful IDOR with sensitive data</td>
            </tr>
            <tr>
              <td>Low</td>
              <td>Minor information leaks, limited CSRF, issues requiring unlikely user interaction</td>
            </tr>
          </tbody>
        </table>
        <p style={{ marginTop: "1rem" }}>
          <strong>Duplicates:</strong> first actionable report wins; variants of the same root cause may be merged.
        </p>
      </section>

      <section id="reporting">
        <h2>How to report</h2>
        <p>
          Email <a href={`mailto:${securityEmail}`}>{securityEmail}</a> with the subject line starting{" "}
          <code>[216Labs BB]</code>. Include:
        </p>
        <ul className="std">
          <li>Affected URL(s) or endpoint(s) and whether production or staging (production preferred for impact).</li>
          <li>Step-by-step reproduction and, if possible, a minimal proof of concept.</li>
          <li>Your assessment of severity and impact; screenshots or redacted logs if helpful.</li>
          <li>Whether you want public credit (name / handle / link) after fix.</li>
        </ul>
        <p>PGP: if you need encrypted email, ask for our current key in your first message.</p>
      </section>

      <section id="response">
        <h2>What to expect</h2>
        <p>
          We aim to acknowledge reports within a few business days and keep you informed through triage and fix. Timelines
          depend on severity and complexity. We may ask clarifying questions; responsiveness helps resolution.
        </p>
      </section>

      <section id="eligibility">
        <h2>Eligibility</h2>
        <p>
          Employees, contractors, and others with privileged insider access are excluded from rewards for issues they
          could have reported through internal channels. Researchers must not be on sanctions lists where it would
          prohibit payment or engagement. Void where prohibited by law.
        </p>
      </section>

      <footer className="page">
        Policy for services under <code>{wildcard}</code>. Contact:{" "}
        <a href={`mailto:${securityEmail}`}>{securityEmail}</a>
      </footer>
    </main>
  );
}
