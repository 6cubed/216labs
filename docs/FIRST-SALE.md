# First sale — unblock checkout this week

216labs has **live apps** and **lead capture** without Stripe.

## Closest to charging (May 2026)

| Rank | App | Why | Blocker |
|------|-----|-----|---------|
| 1 | **StoryMagic** | Fixed $24.99; Payment Link **or** full Stripe checkout; hot-reload on admin save | **Fast:** Payment Link on [Checkout setup](https://admin.6cubed.app/checkout-setup). **Full:** `STORYBOOK_STRIPE_SECRET_KEY` + `STORYBOOK_STRIPE_WEBHOOK_SECRET` |
| 2 | **Merch** | Storefront URL often set; traffic → Printful | Confirm `NEXT_PUBLIC_MERCH_STORE_URL` — see [`MERCH-FIRST-SALE.md`](MERCH-FIRST-SALE.md) |
| 3 | **1PageResearch** | €1 report; free tier works today | `ONEPAGE_STRIPE_*` keys |

Until StoryMagic can take money, the funnel is **waitlist** (`POST /api/waitlist` from 6cubed.app, or `POST /api/print-interest` after a preview) or **Preorder now** when `NEXT_PUBLIC_STORYBOOK_PREORDER_URL` is set (admin **Leads** + Stripe Payment Link). Admin shows a **First sale** banner (or green preorder banner) until checkout or preorder is live.

**Paid traffic:** CEO playbook [`STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md). **One-week test:** [`STORYMAGIC-WEEK-EXPERIMENT.md`](STORYMAGIC-WEEK-EXPERIMENT.md). GA4: `generate_start`, `story_preview_ready`, `waitlist_signup`, `preorder_click`, `begin_checkout`, `purchase`.

**Admin access:** If you cannot open [admin → Env](https://admin.6cubed.app/env) to paste keys, reset credentials first — **`docs/ADMIN-ACCESS.md`** (`/adminpass reset` in Telegram).

**Telegram nudge:** Cron `revenue-env-check` pings you (max 1×/12h) when StoryMagic has waitlist signups but no Payment Link or Stripe checkout configured.

The fastest path to **paid revenue** is **StoryMagic** (fixed price, one webhook).

## 1. Stripe (test mode first)

1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → **Developers → API keys** (test).
2. Copy **Publishable** and **Secret** keys.
3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://storybook.6cubed.app/api/webhook`
   - Events: **`checkout.session.completed` only** (StoryMagic ignores other event types).
4. Copy the **Signing secret** (`whsec_…`).

## 2. Checkout setup (Admin)

Open [admin → Checkout setup](https://admin.6cubed.app/checkout-setup) (or [admin → Env](https://admin.6cubed.app/env)) and set:

| Key | Value |
|-----|--------|
| `STORYBOOK_STRIPE_SECRET_KEY` | `sk_test_…` **(required)** |
| `STORYBOOK_STRIPE_WEBHOOK_SECRET` | `whsec_…` **(required)** |
| `NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` *(optional — checkout is server-side)* |
| `STORYBOOK_BOOK_PRICE_CENTS` | optional (default `2499`) |

Save. On the live admin host, saving a `STORYBOOK_*` key **recreates the storybook container** with updated `.env.admin` automatically (no laptop deploy in the normal path).

## 2b. Preorder without webhook keys (shipped)

If you are not ready to paste `STORYBOOK_STRIPE_*` yet:

1. Stripe Dashboard → **Payment Links** → create a link for the printed book price.
2. Admin → Env → set `NEXT_PUBLIC_STORYBOOK_PREORDER_URL` to that link (public URL).
3. StoryMagic preview shows **Preorder now** (deployed with commit `9c31f1e7`).

Full checkout + order emails in admin still need the two Stripe keys above.

## 3. Verify (after Save)

```bash
./scripts/check-revenue-env-http.sh
```

Expect `[StoryMagic] checkout ready` when keys are set, or `[StoryMagic] preorder LIVE` when only the Payment Link is set. Telegram **`/checkout`** and `./scripts/heartbeat-stack.sh` show `storybook: preorder live` vs `checkout not ready`.

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
| Leads without payment | **Landing** hire form → `lead_event` in `216labs.db` ([admin → Leads](https://admin.6cubed.app/leads)); Telegram **`lead-notify`** cron every 5m. StoryMagic `POST /api/waitlist` (landing) or `POST /api/print-interest` (after preview); 1Page free requests |

**Monetization heartbeat:** this doc is the checklist; the commit that ships revenue is **keys in admin + redeploy**, not the markdown alone.
