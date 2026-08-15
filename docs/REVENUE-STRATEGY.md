# Revenue strategy

**Written 2026-08-15. Supersedes the "first sale is blocked on a Stripe Payment Link" framing in `FIRST-SALE.md` and every production snapshot in `THREAD-CLOSEOUTS.md` since 2026-05-29.**

## The finding

216Labs has no payment problem. It has no audience.

Every retained Caddy access log (2026-04-07 → 2026-08-15, 225,687 requests) reclassified by the
bot filter now running in `edge-visitor-rollup`:

| Surface | Human visitors (all time) | Bots |
|---|---:|---:|
| `6cubed.app` (landing) | 11 | 4,280 |
| `anchor.6cubed.app` | 10 | 379 |
| `zurichrunningclubs.6cubed.app` | 10 | 1,869 |
| `admin.6cubed.app` (us) | 3 | 616 |
| **Every other product** | **0** | **0** |

| Window | Humans | Bots |
|---|---:|---:|
| Last 90 days | 18 | 5,443 |
| Last 30 days | **4** | 1,435 |
| Last 7 days | **0** | 803 |

**Thirty-four human visitors in four months, zero in the last week**, and some of those are us.
The other ~59 shipped products were never requested by anyone — not by a human, not even by a crawler.

Corroborating signals, all from production:

- **StoryMagic waitlist: 0.** `GET /api/checkout/ready` → `waitlistCount: 0`.
- **Leads: 0.** The `lead_event` table has never been created, which means no row was ever inserted.
- **Search referrals: 88 total**, of which 53 are searches for the literal string `6cubed.app`.
- **31,172 `502`s** in the same window: apps that a visitor *would* have hit were often cold or down.
- Of 72 apps in the DB, **10 are deploy-enabled**; 6 have complete checkout code and all 6 have blank keys.

### Why this was invisible

`edge_visitor_day` counted any successful `GET /` as a visitor. Scanners hammering `/`,
`/wp-admin`, and `/.env` produced **1,439 "monthly uniques"** on
[admin → Org metrics](https://admin.6cubed.app/org-metrics) when the real figure was **4** — a
360× overstatement. That number was real enough to look like traction and wrong enough to
justify 2.5 months of checkout plumbing.

The rollup now records `is_bot` per visitor (`ua`, `scanner`, or `no-assets` — a real browser
fetches the page's JS and CSS; crawlers request `/` and vanish). Org metrics reports humans only.

## What follows from it

**A checkout converts a fraction of visitors. Any fraction of ~0 is 0.** Setting every Stripe
key in the portfolio today would produce €0 this month. That work was never the blocker, and
the CEO was never the blocker either.

**The portfolio is the mechanism preventing distribution.** 63 products divide the same finite
attention 63 ways, so each gets none. Building app #64 has strictly negative expected value: it
adds hosting, disk, and cold-start load (the droplet hit 89% disk this month) and returns
nothing without a channel.

## The strategy

Rank by *how many strangers must be reached to earn €1*. With no audience, anything that needs
traffic is disqualified for now.

### 1. Services and contract work — the only path that works at zero audience

Needs **one buyer**, not a thousand visitors, and reaches them by outbound rather than search.
216Labs' proof of capability is unusually strong for a solo shop: 72 shipped apps, CI to GHCR,
an admin control plane, activator cold-start, cron, centralised error reporting.

- **Offer:** production web app delivery, or an AI-feature retainer.
- **Price:** €5–15k per project, or a monthly retainer.
- **Channel:** direct outreach, existing network, contract marketplaces. Not SEO.
- **Math:** one client covers all API and hosting spend many times over and ends the token-cost problem permanently.

### 2. Specialist audio/ML consulting — differentiated and fundable

The CARFAC work is rare expertise, not another AI wrapper: underwater orca detection
(`colabs/carfac-sai-underwater`), drone audio (`colabs/carfac-sai-drone`), bird vocal ID
(`birdperch`). Buyers exist and are funded — marine survey and offshore wind, conservation NGOs,
counter-drone, biodiversity monitoring — plus grant routes that pay for research directly.

Slower to close than (1), higher rate, and it compounds into a defensible position.

### 3. One consumer product — only with a channel commitment

Viable only if the rest is parked and **one** distribution channel is worked for 90 days
against a niche with demonstrable existing demand. StoryMagic at €24.99 needs roughly a
thousand targeted visitors per sale; there is currently no mechanism to produce ten.

## Stop doing

- **Building new apps.** It feels like progress and has produced €0 across 72 attempts.
- **Treating Stripe keys as the blocker.** Set them once when there is traffic to convert; until then they are a 20-minute task, not a strategy.
- **Reporting bot counts as traction.** Fixed in this change.
- **Running products nobody has ever requested.** They cost disk, memory, and attention.

## The only metric that matters now

**First €1 from a human who is not the CEO.** Everything else — uptime, error rates, app count,
commit velocity — is currently a proxy for nothing.

Track human traffic at [admin → Org metrics](https://admin.6cubed.app/org-metrics) ("Human
visitors"). If that number is still ~0, no amount of product work changes the outcome.

## Open decision

Which motion to run: **services**, **audio/ML consulting**, or **one consumer product**. This is
a CEO call because it determines where every subsequent heartbeat goes. Until it is made,
heartbeats should default to distribution work, never checkout plumbing — see
`.cursor/rules/heartbeat-monetization.mdc`.
