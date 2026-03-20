export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
  {
    slug: 'investing-for-the-agi-slope',
    title: 'Investing for the AGI slope',
    excerpt: 'The AGI slope is not one event but a compounding curve. Here is a practical portfolio framework for uncertainty: bars-and-bell bets, compute leverage, and optionality without delusion.',
    date: '2026-03-20',
    body: `
People keep asking the wrong AGI investing question: “When does AGI arrive?” A better one is: “How do I position for a steepening intelligence curve without pretending I can time it perfectly?” The AGI slope is less a single cliff and more a gradient that gets steeper over time — model capability gains, falling inference cost, faster software iteration, and organizational rewiring. The implication for investors is simple: build exposure to compounding capability and protect against narrative whiplash.

**Think in slopes, not dates**

Most portfolios break because they are built around timestamps. AGI doesn’t need to “arrive” in one headline to reprice entire sectors. If capability doubles while cost drops and deployment friction falls, value shifts happen before philosophical AGI debates are settled. So avoid binary framing (AGI or no AGI) and use a slope framing: if intelligence per dollar keeps rising, which assets gain pricing power, which get commoditized, and which become picks-and-shovels?

**A practical AGI portfolio barbell**

One useful structure is a barbell:

- **Core resilience bucket** (the sleep-at-night side): broad indexes, cash equivalents, and durable cash-flow businesses that survive many macro regimes.
- **AGI upside bucket** (the convex side): assets with direct leverage to model capability growth and deployment volume.

This avoids the classic failure mode of going all-in on a single AGI narrative. If the slope steepens slower than expected, you still compound. If it steepens faster, the convex bucket matters.

**Where the convexity tends to be**

Not investment advice, but conceptually the strongest AGI-linked exposures often cluster around:

- **Compute and infrastructure**: chips, networking, power, datacenter buildout, and thermal/cooling supply chains.
- **Model distribution rails**: platforms where inference is consumed at scale (API ecosystems, enterprise copilots, workflow layers).
- **Workflow displacement software**: tools that convert model progress into measurable labor compression or output expansion.
- **Embodied intelligence adjacencies**: robotics and industrial automation where software gains can unlock physical-world productivity.

The key is not “find the smartest model company.” It is “find bottlenecks that get paid as usage scales.”

**What to avoid on the AGI theme**

AGI hype creates crowded trades fast. Three recurring mistakes:

1. **Narrative over unit economics**: beautiful demos with no durable margin structure.
2. **Single-point dependency bets**: companies that only work if one model vendor keeps an edge forever.
3. **Ignoring capex cycles**: infra booms can overbuild before demand catches up.

If a thesis only works under one perfect timeline, it is fragile by definition.

**How to manage uncertainty**

Investing for the AGI slope is mostly risk management under deep uncertainty:

- Use position sizing that assumes you are directionally right but timing-noisy.
- Rebalance on rules, not mood.
- Track real adoption metrics (paid seats, inference volume, gross margin durability), not just benchmark scores.
- Keep optionality capital ready for dislocations; AGI narratives will periodically overshoot and mean-revert.

In other words: be early enough to matter, but diversified enough to survive being early for longer than your ego wants.

**A simple operating checklist**

Before adding an AGI-linked position, ask:

- Does this business benefit from *more* model capability regardless of which lab wins?
- Is there pricing power when inference gets cheaper?
- Are cash flows robust if the slope pauses for 12-24 months?
- Is this exposure replacing or complementing your core resilience bucket?

If you cannot answer these clearly, you are probably buying a story, not a slope.

The AGI era will likely reward investors who combine imagination with discipline. The edge is not perfect prediction. The edge is building a portfolio that compounds across multiple AGI futures while staying alive through the volatility between them.
    `.trim(),
  },
  {
    slug: 'mcp-as-enterprise-governance-layer-on-vibe-coded-scale',
    title: 'MCP as an enterprise governance layer on top of a company that’s been vibe coded to the size of Google',
    excerpt: 'You’ve vibe coded your way to thousands of services and one massive repo. MCP is the control plane that lets you govern, audit, and secure all of it without slowing the loop.',
    date: '2026-03-12',
    body: `
Imagine a company that’s been built the way we build: rapid iteration, AI in the loop, one monorepo, hundreds or thousands of services and apps. No big upfront design — just ship, refine, add another slice. Over time that company reaches Google scale: countless microservices, internal tools, data pipelines, and agent-driven workflows, all grown organically. The vibe got you there. The question is what happens next. How do you govern, audit, and secure that surface without turning it back into the kind of bureaucracy that vibe coding was meant to escape? The answer isn’t to stop vibe coding. It’s to add a thin, consistent layer on top: a protocol that every AI and every tool speaks, so that governance lives in one place. That layer is MCP — the Model Context Protocol — as an enterprise governance plane.

**What MCP is and why it matters at scale**

MCP is an open protocol that defines how AI assistants and applications get context (files, databases, APIs) and perform actions (run tools, call services). Clients (Cursor, Claude, custom agents) connect to MCP servers that expose resources and tools in a standard way. At small scale that’s “nice”: one format for tools, less lock-in. At Google scale it’s structural: every vibe-coded surface that an AI or an agent touches can sit behind an MCP server. That server becomes the single place where you enforce policy, log access, and decide what “the model” is allowed to see and do. You don’t govern a thousand ad-hoc integrations; you govern the MCP layer.

**Governance without killing the vibe**

The classic response to “we’ve grown too fast” is to centralize, lock down, and slow the loop: approval gates, change boards, and “no new services without architecture review.” Vibe coding dies there. MCP offers a different trade. You keep shipping the same way — new app, new tool, new agent — but each of those surfaces is *wired through* MCP. The MCP server for “customer data” doesn’t expose raw DB credentials; it exposes a small, audited set of tools (e.g. “search by segment,” “export with PII stripped”) and logs every call. The MCP server for “deploy” doesn’t hand over prod SSH; it exposes “trigger deploy for app X” with checks and an audit trail. So the *protocol* is the choke point. You don’t slow the developer or the AI; you standardize and govern the *interface* they use. That’s enterprise governance that doesn’t require saying no to the next idea — it requires saying “yes, and it goes through MCP.”

**Audit, compliance, and observability**

Once every AI and every agent talks to the world via MCP, you get a single place to answer: who (or what model) asked for what, when, and with what outcome. That’s audit for free. Compliance (SOC2, HIPAA, internal policy) becomes “we enforce it at the MCP layer”: PII never leaves this server, that tool is only callable in these contexts, and every call is logged. Observability is the same: you don’t instrument a thousand custom integrations; you instrument the MCP servers. So the company that vibe coded to Google scale doesn’t have to retrofit governance into every corner. It retrofits *one* layer — MCP — and pushes all AI and agent traffic through it.

**How it fits the vibe code factory**

We already believe in one repo, one deploy path, one admin. MCP is the same idea applied to “how the AI and the organization interact.” New tools and new agents don’t get special snowflake integrations; they get MCP endpoints that follow the same rules. So when someone prompts “add a new service that reads from the analytics DB,” the answer isn’t “fill out a form and wait for DBA approval.” The answer is “here’s the MCP server for analytics; it exposes these tools, with these guards; plug your agent in and go.” The vibe stays. The governance is in the protocol. That’s how you keep a company that’s been vibe coded to the size of Google from turning into a place where nothing moves without a ticket — and that’s why MCP is the enterprise governance layer that actually fits.
    `.trim(),
  },
  {
    slug: 'roadmap-to-1000-projects-continued-iteration-and-growth',
    title: 'Roadmap to 1000 projects: continued iteration and growth',
    excerpt: 'We’re scaling from ~20 co-existing projects today to 1000 by the end of 2027. Here’s how: centralize enterprise components, lean on a single database, lightweight app toggling, and a clear set of milestones.',
    date: '2026-03-12',
    body: `
The 216labs factory has been iterating successfully: one monorepo, one deploy path, one admin dashboard, and a growing set of apps that share the same rules. We’re now mapping the path from where we are — roughly 20 co-existing projects — to 1000 by the end of 2027. That scale only works if we double down on what already makes the factory work: centralize as much of the common enterprise machinery as we can, keep apps lightweight, and make turning projects on or off as simple as a toggle.

**Where we are today**

We already have a single source of truth (SQLite for admin and pipeline state), manifests per app, Caddy and env vars generated from one place, and deploy driven by “enabled” flags in the admin. PipeSecure, Happy Path, and the admin dashboard all read from the same DB. So the foundation for scale is there. The next phase is making that foundation carry more apps without each one reinventing auth, config, or persistence.

**Centralizing enterprise components**

The roadmap leans on centralizing common pieces so new apps stay thin. Key directions:

- **Single database across the factory.** Today many apps bring their own SQLite or Postgres. We’re moving toward a shared data layer where it makes sense: one primary database (or a small set of logical DBs) that apps can use for auth, feature flags, and shared config, with app-specific tables or schemas where needed. New projects get a slice of the same store instead of standing up a new DB per app. That reduces operational surface and keeps backups, migrations, and tooling in one place.

- **Lightweight toggling from the admin.** Apps are already toggled on or off in the admin dashboard; that drives which services get built and deployed. We’ll harden this: one click to enable or disable an app, with clear feedback (e.g. “next deploy will include/exclude this app”), and optional “pause” states (e.g. deployed but not receiving traffic) so we can scale the number of projects without scaling cost or noise until we need them live.

- **Shared auth and identity.** As we add more apps, we don’t want each to implement login from scratch. A central identity layer — even if it starts as “same session cookie and a small auth service” — lets new projects assume “user is already identified” and focus on their own UX. Same idea for API keys and service-to-service calls: one place to issue and revoke, apps just consume.

- **Unified observability and runbooks.** One place to see “what’s deployed, what’s failing, what’s enabled.” The admin already does some of this; we’ll extend it so that at 100, 500, or 1000 apps we still have a single pane for health, logs, and “what do I turn off if the server is struggling?”

**Milestones on the way to 1000**

We’re treating the journey as a series of milestones rather than a single big bang:

- **100 apps.** Shared DB and app toggling in place; every new app uses the central data layer and appears in the admin as a toggle. Happy Path and PipeSecure scale to the full list; deploy and Caddy generation stay automatic.

- **300 apps.** Central auth/identity in use by most apps; lightweight “template” for new apps (manifest + a few files) so spinning up a new project is a prompt and a toggle. Cost and resource visibility in the admin (e.g. which apps use the most memory or traffic).

- **1000 projects by end of 2027.** Factory runs at 1000 co-existing projects with the same mental model: one repo, one deploy, one admin, one place to look. Most apps are toggled off or paused until needed; the ones that are on share the same enterprise substrate. We’ll have had to solve batching (deploy in chunks), faster discovery (admin and Caddyfile generation at scale), and possibly multi-region or multi-cell patterns — but the principles (centralize, toggle, one DB where it fits) stay the same.

**Why this roadmap fits the vibe**

We’re not rebuilding the factory; we’re extending what already works. Centralizing components and leaning on a single database and admin-driven toggles means each new project is less “new infrastructure” and more “new slice of the same grid.” That’s how we keep the vibe code factory fast and tractable all the way to 1000.
    `.trim(),
  },
  {
    slug: 'how-vibe-coding-transformed-how-we-think-about-tests',
    title: 'How vibe coding transformed how we think about tests',
    excerpt: 'When the cost of deleting and rewriting a module goes to zero, high-level happy-path tests become the post–vibe coding test par excellence. Our Happy Path module is PM and QA in one.',
    date: '2026-03-12',
    body: `
Vibe coding changes the economics of code. You can delete a feature and have the AI rewrite it in minutes. The cost of “throw it away and start again” fades toward zero. That shift changes what tests are *for*. We’re less worried about locking every unit in place and more worried about a simpler question: does the system still do the common-sense things a user would expect? High-level, logical, happy-path style tests — the kind that load the app in a browser, click through the main flows, and assert “it didn’t crash and the obvious thing happened” — become the post–vibe coding test par excellence.

**Why happy path wins now**

In the old world, unit tests protected against the cost of change: refactor something and you wanted a safety net of fast, granular checks. In a vibe code factory, refactors are cheap and the real risk is *regression at the product level*: did we break the thing a human would actually do? So we care less about “did this function return 42?” and more about “did the homepage load, did the first sensible link work, did the core flow complete?” That’s happy-path thinking. It’s also exactly what a good PM or QA person does: they don’t exhaustively test every branch; they ask “does it do the obvious thing?” and “did we break the thing that mattered?” Happy-path tests encode that question and run it continuously.

**Happy Path: PM and QA in one**

Our Happy Path module is the world’s greatest PM and QA tied into one. It runs on a schedule (every few hours), reads the list of enabled apps from the same admin DB that drives the factory, and hits each deployed app in a real browser. For each app it runs a small set of common-sense checks: load the homepage, follow the first sensible link, assert no crash. For apps with defined flows (like Pocket’s agent chat), it runs a fuller scenario: two users join, one pairs with the other, and we assert that messages flow without human intervention. So every app is constantly being asked “are you still doing the thing you’re supposed to do?” Regressions show up as a red row on the Happy Path status dashboard — same place we look for deploy status and security issues. One loop, one place to look.

**Catching regressions, not blocking the vibe**

Happy Path doesn’t block the vibe. It doesn’t run on every commit or gate the deploy. It runs in the background and reports. When something fails, we see it, we fix it, we move on. That fits how we work: we’re not trying to prove correctness with a thousand unit tests; we’re making sure the factory’s output — the apps people actually hit — still pass the “does it make sense?” test. Vibe coding gave us the speed to rewrite modules at will; Happy Path gives us the signal that the things that matter are still working.
    `.trim(),
  },
  {
    slug: 'the-factorys-approach-to-security-vulnerability-detection',
    title: 'The factory’s approach to security vulnerability detection',
    excerpt: 'PipeSecure oversees the growing repo, runs Semgrep and ast-grep on a schedule, and opens or closes GitHub issues daily based on what it finds.',
    date: '2026-03-12',
    body: `
A vibe code factory that ships fast can also ship vulnerabilities: new dependencies, quick patches, and AI-generated code all add surface area. We don’t slow down the loop to manually audit every change. Instead we run a dedicated security pipeline that watches the repo and turns findings into actionable GitHub issues — automatically, on a schedule.

**PipeSecure: overseer of the repo**

PipeSecure is our in-house security module. It clones the 216labs monorepo (or the repo you point it at), runs static analysis with Semgrep and ast-grep using a curated set of rules — SQL injection, XSS, path traversal, SSRF, hardcoded secrets, auth bypass, prototype pollution, eval usage, DOM XSS — and compares results to the previous run. New findings become new GitHub issues, labelled by severity. Fix the code and the next scan no longer sees the finding; PipeSecure closes the issue and adds a “Resolved” comment. So the growing repo is continuously checked without someone having to remember to run a scanner or triage a backlog by hand.

**Daily rhythm, not one-off audits**

We run PipeSecure on an interval (by default every 24 hours). So every day the factory gets a fresh pass: new issues appear when something bad is introduced, and issues disappear when the vulnerability is removed. That fits how we work: we’re not stopping the vibe to do a big security review; we’re letting the pipeline post its findings into the same place we already look — GitHub Issues — and we fix them in the normal flow. Daily scans keep the signal current and the list of open issues a real snapshot of what’s left to fix.

**One dashboard, one source of truth**

PipeSecure exposes a small status dashboard (pipesecure.6cubed.app) that shows the last scan time, how many findings it had, and all open security issues with links to the GitHub issue. So at a glance we see whether the repo is clean or has outstanding items. The issues live in the repo’s issue tracker, so they’re part of the same workflow as every other task. For a factory that already believes in one monorepo, one deploy path, and one admin, PipeSecure is the same idea for security: one scanner, one place for findings, and a daily cadence that keeps the loop tight without blocking the vibe.
    `.trim(),
  },
  {
    slug: 'why-pocket-cursor-accelerates-the-vibe-code-factory',
    title: 'Why Pocket Cursor accelerates the vibe code factory’s productivity',
    excerpt: 'The best ideas don’t wait for you to be at your desk. Pocket Cursor keeps the vibe coding loop open from your phone.',
    date: '2026-03-12',
    body: `
Vibe coding runs on flow: you prompt, the AI builds, you refine. The bottleneck is often *you* — not the model. If you have to be at your laptop to keep the loop going, context gets lost, momentum stalls, and “I’ll do it when I’m back at my desk” becomes “I forgot what I was doing.” Pocket Cursor removes that bottleneck by putting the same Cursor conversation in your pocket.

**Same chat, anywhere**

Pocket Cursor is a Telegram bridge to your running Cursor IDE. It doesn’t run a separate agent or a cloud copy of your chat. It *is* your chat. Messages you send from your phone land in the same Composer thread; the AI’s replies stream back to Telegram. You can approve tool runs, switch chats, start new ones, or just read what the model said — all from your phone. So the vibe code factory doesn’t pause when you step away. You can keep prompting, approving, and steering from the train, the couch, or between meetings.

**Faster feedback, less friction**

Without Pocket Cursor, “quick fix” or “small change” often means: find a machine, open the repo, reopen the chat, remember the context. With it, you tap the notification, reply in Telegram, and the next message is already in Cursor. The factory keeps running. That’s why it accelerates productivity: it doesn’t add a new tool to learn; it extends the one you already use (Cursor) into the places you already are (your phone). Less friction, more iterations.

**Built for the ecosystem**

We run Pocket Cursor alongside the same monorepo and deploy pipeline that make vibe coding shippable. The bridge is a local process; Cursor runs with CDP so the bridge can attach. No data leaves your machine except what you send through Telegram. So you get continuity and speed without giving up control or pushing your code through someone else’s cloud. For a vibe code factory that already cares about one repo, one deploy path, and one source of truth, Pocket Cursor is the same idea applied to *you*: one conversation, one place it lives, available wherever you are.
    `.trim(),
  },
  {
    slug: 'vibe-coding-needs-an-enterprise-grade-ecosystem',
    title: 'Why vibe coding needs an enterprise-grade ecosystem',
    excerpt: 'Vibe coding is fast and fluid — but to ship real products and keep them running, it has to sit inside infrastructure that doesn’t vibe. Here’s why.',
    date: '2026-03-12',
    body: `
Vibe coding is powerful. You describe what you want, the AI writes the code, and in minutes you have a working feature. The flow is intoxicating. But flow alone doesn’t deploy, monitor, or scale. To turn that flow into something that actually runs for users and survives the next refactor, vibe coding needs an enterprise-grade ecosystem around it.

**What “enterprise-grade” means here**

Not “enterprise” in the sense of purchase orders and compliance checklists. We mean: the same qualities that keep big systems reliable — clear contracts, repeatable builds, observable behavior, and a single path from “it works on my machine” to “it works in production.” Vibe coding accelerates the “my machine” part. The ecosystem has to close the gap to production without slowing you down.

**Why the ecosystem matters**

When the AI suggests a new dependency or a new route, you need to know that it will build the same way everywhere, that the app will show up in your dashboard, that env vars are in one place, and that a failed deploy doesn’t leave you guessing. If every project is a one-off script and every deploy is a manual paste, vibe coding just produces more code that’s hard to run and hard to trust. The ecosystem is what makes the output of vibe coding *shippable*.

**What we’re building**

216labs is that ecosystem for our own vibe coding workflow: one monorepo, one deploy path, one admin surface for all apps. Manifests define each app; the same script builds and deploys everything; Caddy and env vars are generated from a single source of truth. When we spin up a new app from a prompt, it doesn’t land in a random folder with a random port — it lands in the same grid, with the same rules. That’s how vibe coding scales from “fun experiment” to “thing that actually runs.”

So: vibe coding gives you speed. The ecosystem gives you a place for that speed to land. Both are necessary.
    `.trim(),
  },
  {
    slug: 'gemini-and-llm-vulnerabilities-what-you-need-to-know',
    title: 'Gemini and LLM vulnerabilities: what you need to know',
    excerpt: 'From GeminiJack’s zero-click data exfiltration to prompt injection and jailbreaks, LLMs open a new attack surface. Here’s the landscape and why it matters.',
    date: '2026-03-12',
    body: `
Google’s Gemini and other large language models are shipping into products at pace — search, cloud assist, enterprise agents. With that comes a new class of vulnerabilities: models that can’t reliably tell “user instruction” from “malicious text in a document,” and that can be nudged into bypassing safety with the right prompts. This post sketches the landscape, with Gemini as a concrete example, and why it should matter to anyone building or relying on LLM-powered tools.

**Gemini in the crosshairs**

Two high-profile research efforts put Gemini’s security in the spotlight.

- **GeminiJack (late 2025).** Researchers showed that Gemini Enterprise and Vertex AI Search could be abused via *indirect* prompt injection. An attacker embeds hidden instructions inside a Google Doc, calendar invite, or email. When a user (or an automated flow) lets Gemini read that content, the model treats the embedded text as legitimate commands. In the demonstrated attack, that led to automatic search across Gmail, Calendar, and Docs and exfiltration of sensitive data — without the user clicking a link or running a script. “Zero-click” in the sense that the victim only had to have Gemini process a document the attacker could influence. Google’s response included decoupling Vertex AI Search from Gemini Enterprise and hardening the underlying pipeline.

- **The “Gemini Trifecta” (Tenable, 2025).** Three separate issues across Gemini’s surface: (1) the **Gemini Browsing Tool** could be abused to exfiltrate saved data and location; (2) the **Search Personalization** model was vulnerable to search-injection via manipulated browser history, leaking user data; (3) **Cloud Assist** accepted crafted content in log entries (e.g. HTTP User-Agent) that could be used for prompt injection, opening the door to phishing or further cloud compromise. All three have been addressed by Google, but they illustrate how many moving parts — browsing, search, logs — become new attack vectors when an LLM is in the loop.

**The underlying pattern: indirect prompt injection**

The thread running through these is *indirect prompt injection*. The model isn’t given a blatant “ignore your instructions” in the user’s message. Instead, the malicious instruction is *inside data the model retrieves*: a web page, an email, a doc, a log line. The model doesn’t have a reliable way to say “this part is from the user, that part is from untrusted content,” so it may follow the hidden instruction as if it were legitimate. That’s a fundamental tension: we want the model to act on “user intent,” but intent can be spoofed by content we feed into the same context. Gemini isn’t uniquely bad here — it’s a structural issue for any LLM that reasons over mixed trusted and untrusted text.

**LLM vulnerabilities in general**

Beyond Gemini, the broader LLM security space has crystallized into a few categories.

- **Prompt injection (direct and indirect).** Direct: the user (or attacker) types instructions that override or bypass the system prompt. Indirect: as above — the malicious prompt is embedded in a document, webpage, or API response the model sees. Defenses (prompt design, filtering, “canonical” instruction channels) are improving but not solved.

- **Jailbreaks.** Multi-turn or single-query techniques that get the model to ignore safety policies: harmful content, forbidden topics, or role-play that bypasses guardrails. Research has shown high success rates against leading models (e.g. adaptive attacks using logprobs, “Crescendo” multi-turn escalation, or embedding jailbreak prompts in long chains). Different models fail in different ways — so there’s no single fix.

- **Tool use and autonomy.** When the model can call APIs, search the web, or read emails, any confusion between “user said” and “data said” can lead to wrong or malicious actions. Gemini’s browsing and cloud-assist issues are examples: the more the model does on the user’s behalf, the more an attacker can try to steer that behavior via poisoned content.

- **Data exfiltration and privacy.** As with GeminiJack, the combination of broad access (Gmail, Calendar, Docs) and weak separation between instructions and data can turn a “helpful” agent into a data-leak channel. Enterprise deployments need to assume that any content the model sees might contain attempted instructions.

**Why this matters for builders**

If you’re integrating an LLM — Gemini or otherwise — into a product that touches sensitive data or performs actions (sending email, editing docs, calling APIs), you’re taking on this attack surface. Mitigations today are mostly layered: restrict what the model can see and do, sandbox tool use, treat all retrieved content as potentially adversarial, and keep auditing and red-teaming. Google’s own response (hardening Gemini 2.5, separating components, defense in depth) is the right direction, but the problem isn’t “solved.” Expect more Gemini and general-LLM vulnerabilities to show up as usage grows. The takeaway: treat LLM-powered features as a new kind of dependency — one that needs threat modeling and continuous attention, not a one-time security review.
    `.trim(),
  },
]

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug)
}
