# First sale — unblock checkout this week

216labs has **live apps** and **lead capture** without Stripe. The fastest path to **paid revenue** is **StoryMagic** (fixed price, one webhook).

## 1. Stripe (test mode first)

1. [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) → **Developers → API keys** (test).
2. Copy **Publishable** and **Secret** keys.
3. **Developers → Webhooks** → Add endpoint:
   - URL: `https://storybook.6cubed.app/api/stripe/webhook`
   - Events: `checkout.session.completed` (and `payment_intent.succeeded` if you use Payment Intents later).
4. Copy the **Signing secret** (`whsec_…`).

## 2. Admin Env

Open [admin → Env](https://admin.6cubed.app/env) and set:

| Key | Value |
|-----|--------|
| `NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` |
| `STORYBOOK_STRIPE_SECRET_KEY` | `sk_test_…` |
| `STORYBOOK_STRIPE_WEBHOOK_SECRET` | `whsec_…` |
| `STORYBOOK_BOOK_PRICE_CENTS` | optional (default `2499`) |

Save. Keys sync to the droplet on the next deploy (or `git pull` + `docker compose up -d storybook` on the VPS).

## 3. Redeploy StoryMagic

```bash
DEPLOY_RUNTIME_APPS=storybook ./deploy.sh root@46.101.88.197
```

## 4. Verify

```bash
./scripts/check-revenue-env-http.sh
```

Expect `[StoryMagic] checkout ready`. In the browser: create a book → **Order** → Stripe Checkout (test card `4242 4242 4242 4242`).

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
| Leads without payment | StoryMagic `POST /api/print-interest`; 1Page free requests |

**Monetization heartbeat:** this doc is the checklist; the commit that ships revenue is **keys in admin + redeploy**, not the markdown alone.
