export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
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
