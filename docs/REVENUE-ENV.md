# Revenue env — admin checklist

**First paid checkout:** step-by-step Stripe + deploy → [`docs/FIRST-SALE.md`](FIRST-SALE.md).

Paid flows read secrets from admin. For Stripe checkout setup, use **[admin → Checkout setup](https://admin.6cubed.app/checkout-setup)** (it tells you exactly what to paste), then **[admin → Env](https://admin.6cubed.app/env)** for the actual key editor. Saving `STORYBOOK_*`, `ONEPAGE_*`, or `NEXT_PUBLIC_MERCH_*` on the **production admin** host regenerates `.env.admin` and **force-recreates** that compose service (no laptop deploy required). Fallback: `./deploy.sh` or `docker compose up -d --force-recreate <svc>` on the VPS.

| App | Keys | Unblocks |
|-----|------|----------|
| **merch** | `NEXT_PUBLIC_MERCH_STORE_URL` — Printful (or other) storefront base URL | Buy buttons on https://merch.6cubed.app |
| **storybook** | `STORYBOOK_STRIPE_SECRET_KEY`, `STORYBOOK_STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY`; optional `STORYBOOK_BOOK_PRICE_CENTS` (default `2499`) | Stripe Checkout on https://storybook.6cubed.app |
| **1pageresearch** | `ONEPAGE_STRIPE_SECRET_KEY`, `ONEPAGE_STRIPE_WEBHOOK_SECRET`; optional `ONEPAGE_ADMIN_SECRET`, `ONEPAGE_BASE_URL` | €1 Stripe checkout on https://1pageresearch.6cubed.app/generate |
| **onefit** / **emailgpt** | Product-specific keys in each manifest | Subscriptions and paid tiers |

**Checkout readiness** (no SSH required):

```bash
./scripts/edge-smoke.sh              # fast parallel probe (~10s); heartbeats run this first
./scripts/check-revenue-env-http.sh  # full revenue checklist (Stripe ready flags)
```

**Automated:** cron job `revenue-env-check` (enabled by default, **every 4 hours** UTC: `0 */4 * * *`) stores results in `cron_runner_state.revenue_env_last` and Telegram-alerts on edge failures. Shown on admin **Checkout setup** and Overview when probes fail.

**Droplet check** (keys inside running containers; falls back to HTTP if SSH fails):

```bash
./scripts/check-revenue-env-droplet.sh
```

**Verify after deploy**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "https://merch.6cubed.app/"
curl -sS -X POST "https://storybook.6cubed.app/api/checkout" -H 'Content-Type: application/json' -d '{"bookId":"<real-id>"}'  # expect JSON `{ "url": "..." }`, not 503
```

**Blocker today:** merch and StoryMagic UI can ship without keys, but checkout stays disabled until the rows above are set in admin and images are redeployed.

**UX when keys are missing:** StoryMagic preview calls `GET /api/checkout/ready` and disables Order with a clear message; merch Buy falls back to a StoryMagic link until `NEXT_PUBLIC_MERCH_STORE_URL` is set.

**Leads without Stripe:** StoryMagic stores **print interest** emails (`POST /api/print-interest`, table `print_interest` in `storybook.db`) and pings admin ingest with `[Print lead]`. **1PageResearch** accepts **free report requests** on `/generate` (`POST /api/request-free`) — review at `/admin/requests` when `ONEPAGE_ADMIN_SECRET` is set.

**Cold apps:** `/api/*` and `/healthz` bypass Activator warmup redirects (see `scripts/generate-caddyfile.py`) so checkout probes return JSON. If probes still fail, start the service: `docker compose up -d 1pageresearch storybook` — revenue apps use `activator_never_evict` where set in manifests.

**After Caddyfile regen:** `docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile` on the droplet (or restart the `caddy` service).

**Droplet down / SSH timeout:** `./scripts/droplet-recover.sh` — see `docs/DROPLET-RECOVERY.md`.
