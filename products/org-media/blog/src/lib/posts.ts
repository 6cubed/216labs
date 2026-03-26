export interface Post {
  slug: string
  title: string
  excerpt: string
  date: string
  body: string
}

export const posts: Post[] = [
  {
    slug: 'six-dollar-droplet-price-sheet-and-scaling-thousands-of-demos',
    title:
      'The $6 droplet price sheet: what this whole setup costs and how thousands of demos still fit',
    excerpt:
      'A line-item overview of the 216labs hosting stack on one small DigitalOcean instance, what is effectively free, what scales with you — and how on-demand cold starts make “thousands of demos” honest without turning one box into a datacenter.',
    date: '2026-03-22',
    body: `
People love a **single number** on the invoice. In our case, the headline is boring on purpose: **one small DigitalOcean droplet** — often marketed around **\$6/month** on the lowest **Basic** tier (check the live pricing page; regions and promos move the exact dollar). Everything else in the factory is either **\$0** or **optional** until you deliberately add it. This post is a **price overview** of the whole setup and a **realistic** story for scaling to **on-demand access to thousands of demos** while keeping **one** instance as the edge.

**What you are buying with that droplet**

A Basic droplet is not a mystery box: it is roughly **1 vCPU**, **1 GB RAM**, **25 GB SSD**, and **1 TB** transfer in the common configuration — again, verify on DigitalOcean’s calculator. That is **enough to terminate TLS**, run a **reverse proxy** (Caddy), host a **small control plane** (Activator + admin), and keep **a handful of app containers warm** — not **hundreds** of fat Node processes at full memory simultaneously.

The important mental model: **you are renting a showroom stall**, not a hyperscale region. The architecture has to admit that.

**Line items (typical factory bill)**

1. **Compute: one droplet** — the **\$6-class** line (or whatever Basic costs when you read this). This is the only *mandatory* recurring hosting charge for “everything on one box.”

2. **IPv4 / networking** — usually **included** in the droplet; no separate “per demo” fee. You point **DNS** at the droplet; Caddy handles **HTTPS**.

3. **Domain & DNS** — **not** DigitalOcean-specific. Budget **roughly \$10–\$15/year** for a domain at a registrar (varies wildly). DNS can be free (many registrars) or part of a provider you already use. This is **per brand**, not per app.

4. **Source control** — **GitHub** (or equivalent) for a private or public monorepo: **\$0** on free tiers for normal team sizes; **paid** only if you need private collaborators at scale or advanced org features. The factory does not charge you per demo in git.

5. **Container registry** — we **do not** rely on pulling a private **\`216labs/*\`** image from Docker Hub for production. **Images are built elsewhere** (developer laptop or CI) and **loaded on the host** during deploy. So you are **not** paying Docker Hub pull fees for every cold start in the default workflow. If you *choose* to move to a registry + pull model later, that becomes a **deliberate** cost line.

6. **Build minutes** — if CI builds images in **GitHub Actions**, you may hit **free tier limits** at high velocity; that is **not** the droplet’s bill. Many small apps stay inside free allowances; heavy matrix builds might need **paid CI** or fewer parallel jobs. Treat this as **optional scale tax**, not “\$6 droplet tax.”

7. **Email / transactional** — only if an app sends mail (Resend, etc.). **Per-app**, usage-based; **not** required to host static or read-only demos.

8. **Secrets** — **\$0** if you store them in your existing admin DB and env injection; the cost is **operational discipline**, not a SKU.

**What does *not* scale on the \$6 line**

- **RAM** — each running container has a **floor** cost (even “small” Node apps are tens to hundreds of MB). **Thousands of demos in git** is easy; **thousands concurrently running** on **1 GB** is fantasy.
- **Disk** — **25 GB** holds **many** images only if you **prune** old layers and avoid shipping a **1 GB** dependency tree in every app.
- **CPU** — cold starts and TLS are fine; **sustained parallel load** across many apps will **queue** on one vCPU.

So the honest claim is not “\$6 runs infinite production.” It is “**\$6 runs a disciplined grid** where **most demos are stopped** until someone hits the URL.”

**How “thousands of demos” becomes realistic**

The factory separates three quantities:

1. **Catalog size** — how many apps exist in the monorepo (**can be thousands over time**).
2. **Images on disk** — how many **built** images sit on the droplet (**bounded by SSD** and hygiene).
3. **Running processes** — how many containers are **up right now** (**bounded by RAM**).

**On-demand** means **(3)** tracks **traffic**, not **(1)**. The **Activator** path (warmup page → **\`docker compose up -d --no-build\`**) turns a **502** into a **cold start** instead of a permanent failure. That is how you get **thousands of URLs** without **thousands of hot processes**.

**Scaling levers that stay compatible with one instance**

- **Cold by default** — demos **sleep** when idle; the **edge** (Caddy + Activator) stays **always on** within the droplet’s tiny footprint.
- **No server-side builds** — **never** compile on the droplet; **build locally or in CI**, transfer artifacts. That keeps CPU spikes off the **\$6** box and avoids installing toolchains in production.
- **Deploy batching & priority** — when disk or time is tight, **ship the spine first** (proxy, activator, admin), then **tail apps** in later batches. The deploy script already thinks in terms of **caps** and **priority lists** so one bad tail app does not starve the whole fleet.
- **Optional LRU eviction** — you *can* cap concurrent running apps to protect RAM, at the cost of **churn** if someone browses many subdomains quickly. Defaults in a **browsing** grid often favor **no cap**; a **RAM-starved** host might turn the cap back on with eyes open.

**When you outgrow \$6 without changing the story**

You do not need to abandon the **single-droplet demo grid** to grow. You **graduate** specific workloads:

- **Move heavy databases** or **large object storage** to managed services (still cheap at small scale).
- **Put CI** on **paid minutes** when **parallelism** matters more than **\$0**.
- **Add a CDN** in front of static assets if **global latency** matters — still orthogonal to “one origin droplet.”

The **narrative** stays: **one origin**, **many demos**, **cold until needed** — until traffic or compliance forces a split.

**Bottom line**

The **entire** 216labs-style setup, at minimum, is **domain + one small droplet + free git + your time**. The **\$6** line buys **TLS, routing, and a place to run a few warm containers**; **thousands of demos** live in **git and on disk** as **artifacts**, with **on-demand wake** so **RAM** tracks **attention**, not **ambition**. That is how the math stays boring — and **honest**.
    `.trim(),
  },
  {
    slug: 'github-actions-container-images-off-server-scale',
    title:
      'GitHub Actions and container registries: building off-server at scale',
    excerpt:
      'CI turns every push into reproducible images without touching production disks. Here is how Actions, caching, and a registry make “build once, run anywhere” real — and why that matters when you outgrow one laptop.',
    date: '2026-03-22',
    body: `
Shipping **many services** from one monorepo eventually bumps into a boring truth: **building is work**, and **where** you build is a scaling decision. Laptops are finite. Production servers should not compile your dependency graph on every deploy. **GitHub Actions** (and the same idea in other CI clouds) exists so builds run on **disposable, parallel, off-server** machines — and **container registries** exist so the **output** of those builds is **stored as an artifact** you can pull later, not recreated by hand on each host.

**What “off-server” means here**

Not “mystical cloud.” It means: **the machine that runs \`docker build\` is not the machine that serves traffic.** Your droplet, VM, or Kubernetes node should mostly **pull an image** and **start a container** — not compile Rust, resolve npm, and warm caches while users wait. Off-server CI is how you keep that separation honest at **scale** (dozens of images, frequent pushes, clean audit trails).

**GitHub Actions as a build farm**

Actions gives you **on-demand Linux runners** (and Windows/macOS when you need them) with:

- **Parallelism** — matrix builds for multiple apps, languages, or versions without serializing on one CPU.
- **Caching** — layer caches for Docker BuildKit, dependency caches for npm/pip/cargo, so repeat builds are fast instead of punitive.
- **Triggers** — push, PR, schedule, \`workflow_dispatch\`: the factory decides *when* a build is worth doing.
- **Secrets without pasting** — registry credentials and deploy tokens live in GitHub, not in shell history.

None of that requires your laptop to stay awake or your production box to have **gcc** and **300 GB of node_modules**.

**Where the images live: registries at scale**

A container image is a **content-addressed bundle** of layers. Once CI runs \`docker build\`, the usual move is **push** to a **registry**:

- **GHCR** (GitHub Container Registry) sits next to your repo and permissions model.
- **Docker Hub** and other vendors offer the same primitive: **upload layers, get a tag or digest**.

That registry is **off-server storage** in the most important sense: it is the **system of record** for “what we built,” **versioned** and **immutable** (especially if you deploy by digest). Runtimes **pull** — they do not improvise a build.

**Why this scales where “SSH and docker build” does not**

For one pet project, building locally and copying an image to a server is fine. For **many apps** and **many contributors**, you hit:

- **Nondeterminism** — “works on my machine” becomes “works on whoever ran deploy last.”
- **Throughput** — one machine cannot compile the whole grid at once.
- **Security** — production should not need compiler toolchains or read your full source tree to run a binary artifact.

CI + registry replaces that with: **commit → workflow → image → tag/digest → deploy pulls artifact**. The **build** scales with GitHub’s pool; the **edge** stays thin.

**How this fits “containers at scale”**

At scale you care about:

1. **Artifact immutability** — deploy references **digest**, not “latest” in anger.
2. **Promotion** — same image from staging to prod; only config changes.
3. **Parallel services** — each Dockerfile becomes a pipeline job or a matrix row; failures are **per app**, not a single giant script exit code.
4. **Retention & cleanup** — registries hold old tags; policies GC what you do not need.

Actions does not *replace* good architecture (manifests, compose, reverse proxies), but it **industrializes** the step that turns source into **something runnable**.

**Honest contrast: not every shop uses CI for every image**

Some teams **build locally** and transfer images ( bandwidth trade, air-gapped, or simplicity). The principle is the same: **the server that faces users is not where the heavy build belongs.** Actions is one way to get a **shared, logged, cacheable** build layer; the registry is where **scale** stops depending on any single laptop’s disk.

**Bottom line**

**GitHub Actions** gives you **off-server, parallel, cacheable builds**. **Container registries** give you **durable, versioned storage** for those builds. Together they are how teams run **many** containerized services without turning every production host into a compile farm — which is exactly what “at scale” has always meant: **separate the factory from the showroom**, then connect them with a **pull**.
    `.trim(),
  },
  {
    slug: 'scalable-marketing-and-automated-early-signals',
    title:
      'Scalable marketing for a vibe code factory: dollar discipline and automated early signals',
    excerpt:
      'How a factory of many small apps can buy distribution without lighting money on fire — and why the same spend pipeline can double as an early product signal loop across the portfolio.',
    date: '2026-03-22',
    body: `
A **vibe code factory** does not ship one hero product; it ships **many experiments** that each deserve a fair shot at users. Marketing at that scale cannot be “hire a growth team per app.” It has to be **repeatable**, **measurable**, and honest about **marginal value per dollar** — and it should produce **early signal** that tells you which demos deserve more wood behind the arrow.

This post outlines several **distribution approaches**, with **pros and cons**, and ties them to a simple idea: **marketing spend is also a probe**. If you instrument it, the same dollars that buy reach can buy **ranked comparisons** across apps.

**The constraint: spend that still feels like money**

Scalable marketing is not “spend more.” It is **spend with a closed loop**:

- **Unit economics you can name** — cost per click, per install, per qualified sign-up, per retained session — even if early numbers are rough.
- **Creative throughput** — you can generate many variants without a human bottleneck.
- **Portfolio comparability** — two apps can be judged on the same dashboard, not two different anecdotes.
- **Kill / pivot rules** — when an app fails cheap tests, the factory stops funding it and ships the next one.

That last point is how marketing stays aligned with **value for dollar**: every channel is also a **filter**.

**Approach 1: Paid social with video UGC — including AI “human” presenters**

**What it is:** Short vertical ads (Meta, TikTok, etc.) that look like user-generated content: a face in frame, a hook in the first second, a screen recording or demo, a strong CTA. **AI-generated or AI-assisted** presenters (avatars, lip-sync, or synthetic hosts) can scale **face + voice + localization** faster than casting.

**Pros**

- **Creative velocity:** dozens of hooks and angles per app without a production crew every time.
- **Platform-native feel:** UGC-style ads often beat glossy brand spots for app installs.
- **Rapid iteration:** swap hooks weekly; the factory learns what resonates per category.
- **Portfolio leverage:** one “ad recipe” (structure, pacing, captions) can template across many apps; only the demo and offer change.

**Cons**

- **Trust and platform risk:** synthetic humans can trigger **uncanny valley**, policy scrutiny, or user backlash if disclosure is unclear. **Label thoughtfully** and prefer authenticity where it matters.
- **Attribution mess:** iOS privacy and multi-touch journeys make “which ad won?” noisy — you need modeled outcomes and humility.
- **Creative fatigue:** fast iteration can become spammy noise unless quality bars exist.
- **Not every app is “video-shaped”:** B2B tools and niche utilities may not convert from TikTok energy; the format selects for certain products.

**Signal value:** Strong for **hook-market fit** and **message-market fit** before you over-invest in product. Weak alone for deep retention unless you pair installs with in-product events.

**Approach 2: Search and intent capture (Google, Apple Search Ads, long-tail SEO)**

**What it is:** Bidding on **high-intent keywords** and building **landing pages** that map one problem → one app. For mobile, **ASA** meets users already searching the store.

**Pros**

- **Demand is pre-qualified** — people are literally searching for a solution.
- **Easier to compare apps** — CPC and conversion rates sit on the same axis across the portfolio.
- **Compounds with good naming** — clear app names and screenshots reduce wasted clicks.

**Cons**

- **Crowded auctions** — generic keywords are expensive; niche apps need **long tail** discipline.
- **SEO latency** — organic search is a slow burn; not a week-one spike channel.
- **Thin pages at scale** — programmatic SEO can become **junk** if each app does not have a defensible, specific promise.

**Signal value:** Excellent **problem-solution fit** signal. If intent exists and your app still loses, the bottleneck is likely **product or positioning**, not awareness.

**Approach 3: Community and forum presence (Reddit, Discord, niche forums) — organic + light promotion**

**What it is:** Show up where **self-selected** users already discuss the pain. Value-first posts, AMAs, “I built this because…” transparency, and **rules-respecting** promotion.

**Pros**

- **High-trust environments** for certain personas (developers, hobbyists, parents, etc.).
- **Cheap learning** — comments are qualitative gold if you read them as data.
- **Story assets** — real objections become better ad copy elsewhere.

**Cons**

- **Does not scale linearly** — time-heavy; automation is risky (spam kills accounts).
- **Reputation risk** — one tone-deaf post scales **negatively**.
- **Inconsistent reach** — hard to compare apps fairly on the same timeline.

**Signal value:** Best for **language-market fit** and **objection libraries**. Use it to **inform** paid creative, not as the only growth lever.

**Approach 4: Cross-app house inventory (newsletter, “new drop” feed, shared social)**

**What it is:** The factory itself is a **media property**: subscribers who like *one* 216labs-style experiment opt in to hear about **the next**. A lightweight changelog / “app of the week” reduces marginal CAC for new launches.

**Pros**

- **Zero marginal CAC** at send time for the next app (not zero to build the list).
- **Brand compounding** — “I trust this studio” lowers skepticism for new demos.
- **Natural A/B** — which subject lines and which apps get clicks becomes a **portfolio leaderboard**.

**Cons**

- **Audience fit ceiling** — subscribers may not match every niche app.
- **Fatigue** — too many launches erode attention; cadence matters.
- **Still requires content** — someone must ship honest updates worth opening.

**Signal value:** Great for **sequential learning** and **warm launches**. Pair with deep links and per-app analytics.

**Approach 5: Partnerships and embeds (APIs, integrations, “works with…”)**

**What it is:** Distribution through **other products’ ecosystems** — calendars, Notion, Shopify, browser stores, etc.

**Pros**

- **Trust transfer** from platforms users already use.
- **Defensible** if the integration solves a real workflow.

**Cons**

- **Slow and bespoke** per integration — poor fit for a pure “ship fast every week” model unless you standardize a **connector playbook**.
- **Platform dependency** — API changes can break you.

**Signal value:** High when it works — **workflow-market fit**. Hard to run as a blanket strategy for every app.

**Automated early signal: make the ad account a lab**

The scalable move is to treat **campaign metadata + outcomes** as a first-class feed:

1. **Stable naming** — every ad carries \`app_id\`, \`channel\`, \`creative_id\`, \`hypothesis\` (e.g. “pain-first hook vs curiosity hook”).
2. **Event plumbing** — install → first value action (time-to-first-success) → D7 return, even if minimal.
3. **Portfolio dashboards** — sort apps by **cost per first success**, not vanity installs.
4. **Automatic triage** — rules like “if spend > X and no success events, pause and write a post-mortem stub” keep the factory honest.

That is how marketing stays **scalable in decision-making**, not just in ad volume: **machines aggregate**, humans **interpret** the top and bottom of the leaderboard.

**Where AI-generated humans fit**

They are a **production accelerant**, not a strategy. Used well, they lower the cost of testing **many messages**. Used poorly, they substitute **fake charisma** for **clear value**. The winning pattern is: **synthetic presenter + real screen capture + specific promise + disclosed synthesis when material**.

**Bottom line**

The vibe code factory wins when **distribution is templated**, **economics are visible**, and **each dollar buys both users and information**. Meta ads with AI-assisted spokespeople are one tile in that mosaic — powerful for creative throughput, dangerous if trust is treated as optional. Mix **intent channels**, **community listening**, **house inventory**, and **selective partnerships** so no single platform owns your learning — then let **automated measurement** turn spend into a **ranked map** of which apps deserve the next chapter.
    `.trim(),
  },
  {
    slug: 'activator-thousands-of-demos-on-one-droplet',
    title: 'Activator: thousands of demos on one $6 droplet (for real)',
    excerpt:
      'Cold containers, a reverse proxy, and honest limits — how we wake demos on demand without building on the server, and what we changed so the story matches the code.',
    date: '2026-03-22',
    body: `
A **$6 DigitalOcean droplet** is not a generous computer: about **1 GB RAM**, **1 vCPU**, **25 GB disk**. It is, however, enough to **host a showroom** — if you refuse to pretend it is a Kubernetes cluster. The trick is to separate three ideas that people often smush together:

1. **Owning the code** for many demos (thousands over time, in one monorepo).
2. **Shipping** those demos as **pre-built images** from your laptop or CI — never compiling on the droplet.
3. **Running** only what traffic needs **right now**, and waking the rest **on demand**.

That third piece is what we call the **Activator**.

**What users see**

A demo lives at \`{app}.yourdomain.com\`. If its container is stopped, the reverse proxy (Caddy) does not magically invent an upstream — it sees a dead socket and returns **502**. We catch that and send the browser to a small **warmup** page served by the Activator. That page calls \`POST /api/start/{app}\`, which runs \`docker compose up -d --no-build\` for **one** compose service, waits until it is healthy enough, then sends the user back to the real URL.

No custom Go proxy is required: **Caddy + Flask + Docker** are enough. The “serverless” feel is **hold connection → start workload → retry**, not fairy dust.

**What “thousands of demos” actually means**

You can store **thousands** of app folders in git. You cannot run **thousands** of Node or Python containers at full RAM simultaneously on a 1 GB machine — and you should not try. The honest model is:

- **Disk**: images for all shipped apps can exist on disk over time (within 25 GB if you prune sensibly and transfer images **sequentially** during deploy so the daemon never unpacks a giant multi-image tarball in one gulp).
- **RAM**: only **N** containers are **running** at once; the rest are **stopped** images. **N** is bounded by memory, not by your ambition.
- **CPU**: cold starts cost seconds; that is acceptable for a **demo grid**, not for a latency-sensitive API.

So “thousands of demos” means **thousands available to wake**, not thousands concurrently hot. Production honesty beats marketing.

**Where we fixed the story in code**

While writing this, two behaviours did not match a grid you can actually browse:

1. **LRU eviction with a low cap** — We had experimented with a **max concurrent app** pool so the droplet would stop idle containers to save RAM. That is valid on paper, but **browsing many subdomains in a row** looks like an attack on the pool: container 11 evicts container 1, so demos “randomly” go cold. **Default is now unlimited** (\`ACTIVATOR_MAX_CONCURRENT_APPS=0\`); turn a cap on only when you are truly RAM-starved and understand the tradeoff. Edge services (**Caddy, Activator, Admin, Landing**) stay protected from eviction when a cap is enabled.

2. **SQLite as a gate** — Cold start used to require a row in \`216labs.db\` for every app. That is great for the admin dashboard, but it is a poor gate for **git-first** demos. The Activator now **falls back to \`manifest.json\`** on disk (same layout as the rest of the repo) to resolve \`docker_service\` and to refuse apps with **no HTTP port** (\`internal_port <= 0\`). If the image is on the host, you can wake the demo **before** the admin backfill catches up.

**What still has to be true**

- **Images exist locally** on the droplet (\`216labs/{service}:latest\`). We do **not** pull private \`216labs/*\` tags from Docker Hub; **\`./deploy.sh\`** builds on your machine and loads images over SSH. Compose uses \`pull_policy: never\` so a missing tag does not become a failed \`docker pull\`.
- **Caddy knows the hostname** — subdomains are generated from manifests so new apps get TLS and routing.
- **Activator stays up** — deploy runs in **phases** (edge + Activator first) so a bad tail app does not prevent the warmup path from working.

**GET /healthz** on the Activator returns \`max_concurrent_apps\`, \`lru_enabled\`, and \`manifest_fallback: true\` so you can verify behaviour without reading env files.

**Why this is worth doing**

If your goal is **a permanent URL per demo** and **paying coffee money for hosting**, you need a architecture that admits **small hardware** and **large ambition**. The Activator is not “scale to zero” in the cloud-vendor sense; it is **scale to zero running processes** on **one** machine you control, with **one** deploy story and **one** place to look when something is cold.

That is the bet: **thousands of demos in the repo**, **one droplet on the invoice**, and **honest cold starts** instead of a 502 and a shrug.
    `.trim(),
  },
  {
    slug: 'vibe-coding-in-the-limit-putting-production-order-on-demo-chaos',
    title: 'Vibe-coding in the limit: Putting production order on demo chaos',
    excerpt:
      'When demos multiply faster than ops can breathe, you need a factory: one repo, one deploy path, honest tradeoffs, and a roadmap that turns chaos into a flywheel.',
    date: '2026-03-21',
    body: `
Vibe coding is a superpower: you can ship a credible UI, a working API, and a story in an afternoon. The trouble starts when “afternoon” becomes “forty apps,” each with its own port, env vars, reverse proxy, and half-finished deploy story. Production is not the opposite of vibe — it is what happens when the *same* creative loop runs inside constraints that don’t lie: disk, RAM, DNS, TLS, and the fact that users hit URLs, not your intentions.

This is the limit: **demo chaos at scale**. The challenges are predictable. So is the fix: **centralize what repeats, automate what bores you, and admit what still has to be manual** until the factory catches up.

**What actually breaks first**

When you run many vibe-coded apps on one modest host, you don’t fail because the code is “too AI.” You fail because **surface area outgrew attention**:

- **Deploy is a graph problem.** Building and transferring dozens of images on every change stops being “run a script” and starts being “who gets CPU, disk, and SSH time today?” Caps and priority lists become policy, not pettiness.
- **The edge is shared.** One Caddyfile, one certificate story, one place where a missing upstream becomes a **502** — and if the thing that’s supposed to *wake* cold containers is itself cold, you’ve built a redirect loop into disappointment.
- **Truth scatters.** Env vars in three places, “enabled” in a dashboard, reality in \`docker ps\`. The factory only works when **one SQLite brain** (or equivalent) can say: this app exists, this is its port, this is whether it ships, these are its secrets — without a human diffing YAML at midnight.
- **Demos are not observability.** Happy path tests and security scans don’t replace product judgment, but without them you’re flying blind: you find out a subdomain is dead when a human tries it.

None of this is an argument against vibe coding. It is an argument for **putting production order around the demos** so the creativity compounds instead of corroding.

**What we leaned on: centralization and synergies**

The useful kind of centralization is boring on purpose:

- **One monorepo** so “where does this live?” is never a meeting.
- **Manifests per app** so metadata, ports, and env *keys* are data, not archaeology.
- **One deploy path** so “ship it” means the same script, the same build policy (always local images, never build on the droplet), the same transfer story.
- **Generated edge config** so hostnames track manifests instead of hand-edited routes.
- **Admin + SQLite as source of truth** for what is enabled and what secrets exist — with migrations when new columns appear, because the system grows.
- **Cross-cutting modules** where they earn their keep: scheduled browser checks for “does the obvious thing still work?”, scheduled static analysis for “did we paint a new hole?”, and a **cold-start path** so stopped containers aren’t permanent 502s if the machinery can safely bring them up.

Synergy is the payoff: **PipeSecure, Happy Path, and deploy all read the same world.** Change the app list once; the factory doesn’t need a separate spreadsheet to know what exists.

**Honest tradeoffs**

Centralization does not erase complexity — it **concentrates** it. Someone has to own the deploy script when it needs two phases: edge and bootstrap first, long tail second, so one missing image doesn’t starve the whole fleet. Someone has to decide **how many apps** get a full image transfer this week when disk is tight. That’s not bureaucracy; it’s **scheduling under constraints**, which every real factory has always done.

**Roadmap: boosting the flywheel**

Here is the direction we’re pushing — not a promise that every box is checked, but a clear sequence for compounding:

1. **Harden the spine.** Treat Caddy + bootstrap services + deploy phases as **first-class**: they must come up even when the tail of the compose file is noisy. Make “activator up” and “edge up” independent of “every niche app had a perfect day.”
2. **Tighten the cap story.** Deploy batching and priority lists are already policy as code; next is clearer **operator feedback** when an app is enabled in admin but not in this week’s image set — so intent and reality don’t diverge silently.
3. **Shared identity and auth where it hurts.** New apps shouldn’t each reinvent login; a thin shared layer means new demos stay demos, not security snowflakes.
4. **Pause states, not just on/off.** “In the repo” vs “receiving traffic” vs “built this week” are three different knobs; exposing them reduces the temptation to fix everything with another full deploy.
5. **Observability that matches the grid.** One place to see health across the manifest — not full APM for every toy, but **enough signal** to know what to restart before a human reports it.
6. **Templates that encode decisions.** Scaffold + manifest + default test hooks so the path from prompt to *grid citizen* is shorter every time.
7. **Scale the *protocols*, not just the apps.** MCP-style boundaries for how agents and tools touch production data — so governance rides on interfaces, not on saying “no” to the next demo.

**The point**

Vibe coding in the limit is not “slow down.” It is **speed with memory**: the same joy of shipping, but with a factory that remembers what shipped, where it lives, and whether it still runs. Demo chaos becomes a backlog with an owner; production order becomes the **flywheel** that lets the next hundred demos cost less than the last ten.

That’s the bet: not less creativity — **more of it**, because the floor is solid enough to stand on.
    `.trim(),
  },
  {
    slug: 'why-vlms-are-not-the-solution-for-vision-intelligence',
    title: 'Why VLMs are not the solution for vision intelligence',
    excerpt: 'Vision Language Models map pixels to text — but vision intelligence is about spatial reasoning, physics, and action. The language bottleneck loses what matters.',
    date: '2026-03-21',
    body: `
Vision Language Models (VLMs) are having a moment. Throw an image at GPT-4V or Gemini, get a caption, answer a question, describe what you see. The demos are impressive. But VLMs are not the path to solving vision intelligence. They are a useful tool for one narrow slice of the problem — turning images into text — while the rest of what vision is for gets compressed away.

**Vision is not a translation problem**

Vision intelligence is fundamentally about spatial reasoning, object permanence, physics, and causality. A system that "understands" a scene knows that the cup behind the laptop is still there when you can't see it. It knows that pushing the block will move it, that the shadow implies a light source, that the person in the photo is the same entity across frames. None of that requires language. VLMs are trained to map pixels to tokens. The "understanding" that emerges is a side effect of predicting the next word — not of building internal representations of the visual world. The language layer is a lossy bottleneck. We're optimizing for "what would a human say about this image?" instead of "what is actually going on in this image?"

**Benchmarks reward the wrong thing**

VLMs excel at VQA, captioning, and visual reasoning benchmarks because those tasks are *defined* in linguistic terms. "Describe the scene." "What color is the car?" "How many objects are visible?" The benchmark is the model. When we measure vision by how well a system generates text about images, we get systems that are very good at generating text about images. But real vision intelligence — knowing that an occluded object persists, inferring force and motion from a single frame, understanding affordances ("graspable," "climbable") — doesn't reduce neatly to "describe what you see." We're measuring language output and calling it vision.

**Action needs vision, not captions**

True vision intelligence exists to support action: where to reach, how to navigate, what to avoid, how to manipulate. Robots, embodied agents, and interactive systems need vision that feeds directly into control. VLMs output text. The gap between "describe the red block" and "pick up the red block" is enormous. You can bolt a VLM onto a robot and prompt it to output coordinates or commands — and people do — but that's routing vision through a language model that was never trained for low-latency, precise, control-oriented output. The architecture is wrong for the task. Vision for action needs tight coupling between perception and motor control, not a detour through natural language generation.

**Scale doesn't fix the architecture**

Throwing more data and parameters at the vision-language mapping doesn't solve the fundamental mismatch. Vision deals with continuous, analog, high-dimensional signals. Language is discrete and symbolic. The translation layer necessarily loses information. A VLM can describe a face; it can't give you a representation that supports face recognition, emotion detection, gaze estimation, and 3D reconstruction with equal fidelity. It gives you one output: text. That's useful for chat. It's not a general vision substrate.

**What would vision intelligence actually look like?**

Not "describe this image." More like: representations that support many downstream tasks without going through language. Systems that reason over spatial structure, occlusion, and physics. Architectures that couple perception to action with minimal latency. Benchmarks that measure generalization to novel combinations, systematic variation, and embodied success — not "did the model say the right words?" VLMs are a great product for "show me an image and I'll talk about it." They are not the foundation for the kind of vision intelligence that agents, robots, and general-purpose AI will need. That path runs through different architectures, different training objectives, and a clear separation between "vision as a service to language" and "vision as a service to the world."
    `.trim(),
  },
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

At 216Labs we are building the toolkit for production grade vibes. That toolkit is the ecosystem for our own vibe coding workflow: one monorepo, one deploy path, one admin surface for all apps. Manifests define each app; the same script builds and deploys everything; Caddy and env vars are generated from a single source of truth. When we spin up a new app from a prompt, it doesn’t land in a random folder with a random port — it lands in the same grid, with the same rules. That’s how vibe coding scales from “fun experiment” to “thing that actually runs.”

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
