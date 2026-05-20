# Revenue env — admin checklist

Paid flows read secrets from **admin Env** (`https://admin.6cubed.app/env`), synced to the droplet on deploy. Set keys there, then redeploy the app (or full `./deploy.sh`).

| App | Keys | Unblocks |
|-----|------|----------|
| **merch** | `NEXT_PUBLIC_MERCH_STORE_URL` — Printful (or other) storefront base URL | Buy buttons on https://merch.6cubed.app |
| **storybook** | `STORYBOOK_STRIPE_SECRET_KEY`, `STORYBOOK_STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY`; optional `STORYBOOK_BOOK_PRICE_CENTS` (default `2499`) | Stripe Checkout on https://storybook.6cubed.app |
| **onefit** / **emailgpt** | Product-specific keys in each manifest | Subscriptions and paid tiers |

**Verify after deploy**

```bash
curl -sS -o /dev/null -w "%{http_code}\n" "https://merch.6cubed.app/"
curl -sS -X POST "https://storybook.6cubed.app/api/checkout" -H 'Content-Type: application/json' -d '{"bookId":"<real-id>"}'  # expect JSON `{ "url": "..." }`, not 503
```

**Blocker today:** merch and StoryMagic UI can ship without keys, but checkout stays disabled until the rows above are set in admin and images are redeployed.

**UX when keys are missing:** StoryMagic preview calls `GET /api/checkout/ready` and disables Order with a clear message; merch Buy falls back to a StoryMagic link until `NEXT_PUBLIC_MERCH_STORE_URL` is set.
