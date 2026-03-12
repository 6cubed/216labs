export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
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

PipeSecure exposes a small status dashboard (pipesecure.agimemes.com) that shows the last scan time, how many findings it had, and all open security issues with links to the GitHub issue. So at a glance we see whether the repo is clean or has outstanding items. The issues live in the repo’s issue tracker, so they’re part of the same workflow as every other task. For a factory that already believes in one monorepo, one deploy path, and one admin, PipeSecure is the same idea for security: one scanner, one place for findings, and a daily cadence that keeps the loop tight without blocking the vibe.
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
]

export function getPostBySlug(slug: string): Post | undefined {
  return posts.find((p) => p.slug === slug)
}

export function getAllSlugs(): string[] {
  return posts.map((p) => p.slug)
}
