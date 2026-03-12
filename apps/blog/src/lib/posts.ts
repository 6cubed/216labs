export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
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
