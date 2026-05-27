# First sale — unblock checkout this week

216labs has **live apps** and **lead capture** without Stripe.

## Closest to charging (May 2026)

| Rank | App | Why | Blocker |
|------|-----|-----|---------|
| 1 | **StoryMagic** | Fixed $24.99, one Stripe webhook, hot-reload on admin save | **2** test keys in [admin → Env](https://admin.6cubed.app/env): `STORYBOOK_STRIPE_SECRET_KEY`, `STORYBOOK_STRIPE_WEBHOOK_SECRET` (publishable optional) |
| 2 | **Merch** | Storefront URL often set; traffic → Printful | Confirm `NEXT_PUBLIC_MERCH_STORE_URL` points at a live store |
| 3 | **1PageResearch** | €1 report; free tier works today | `ONEPAGE_STRIPE_*` keys |

Until StoryMagic keys land, **print-interest** emails on the preview page are the revenue funnel (`POST /api/print-interest`, `./scripts/query_storybook_print_leads.sh` on the droplet). Admin shows a **First sale** banner on every page until checkout probes pass.

**Admin access:** If you cannot open [admin → Env](https://admin.6cubed.app/env) to paste keys, reset credentials first — **`docs/ADMIN-ACCESS.md`** (`/adminpass reset` in Telegram).

The fastest path to **paid revenue** is **StoryMagic** (fixed price, one webhook).

## 1. Stripe (test mode first)

1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → **Developers → API keys** (test).
2. Copy **Publishable** and **Secret** keys.
3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://storybook.6cubed.app/api/webhook`
   - Events: `checkout.session.completed` (and `payment_intent.succeeded` if you use Payment Intents later).
4. Copy the **Signing secret** (`whsec_…`).

## 2. Admin Env

Open [admin → Env](https://admin.6cubed.app/env) and set:

| Key | Value |
|-----|--------|
| `STORYBOOK_STRIPE_SECRET_KEY` | `sk_test_…` **(required)** |
| `STORYBOOK_STRIPE_WEBHOOK_SECRET` | `whsec_…` **(required)** |
| `NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` *(optional — checkout is server-side)* |
| `STORYBOOK_BOOK_PRICE_CENTS` | optional (default `2499`) |

Save. On the live admin host, saving a `STORYBOOK_*` key **recreates the storybook container** with updated `.env.admin` automatically (no laptop deploy in the normal path).

## 3. Verify (after Save)

```bash
./scripts/check-revenue-env-http.sh
```

Expect `[StoryMagic] checkout ready`. In the browser: create a book → **Order** → Stripe Checkout (test card `4242 4242 4242 4242`).

## 4. Fallback redeploy (only if Save did not recreate storybook)

```bash
DEPLOY_RUNTIME_APPS=storybook ./deploy.sh root@46.101.88.197
```

## 5. Go live

Repeat with **live** keys in Stripe, switch admin Env to `pk_live_` / `sk_live_`, update the webhook URL to production, redeploy.

## If checkout probes fail

- **Container stopped:** `./scripts/droplet-recover.sh` (starts `storybook` + edge).
- **Activator warmup HTML:** Caddy should pass `/api/*` through — see `docs/REVENUE-ENV.md`.
- **Keys set but still not ready:** SSH or admin logs; confirm env inside the `storybook` container.

## Other paid paths (after StoryMagic)

| App | Doc |
|-----|-----|
| Merch storefront | `NEXT_PUBLIC_MERCH_STORE_URL` in `docs/REVENUE-ENV.md` |
| 1PageResearch €1 report | `ONEPAGE_STRIPE_*` keys |
| Leads without payment | **Landing** hire form → `lead_event` in `216labs.db` ([admin → Leads](https://admin.6cubed.app/leads)); Telegram **`lead-notify`** cron every 5m. StoryMagic `POST /api/print-interest`; 1Page free requests |

**Monetization heartbeat:** this doc is the checklist; the commit that ships revenue is **keys in admin + redeploy**, not the markdown alone.
