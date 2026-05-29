# StoryMagic — one-week revenue experiment (<30 min to start)

Run this when engineering is done and you only need **one Payment Link** to test demand.

## Start (CEO, ~15 min)

1. [Stripe → Payment Links (test)](https://dashboard.stripe.com/test/payment-links/create) — product **$24.99** “StoryMagic printed hardcover”.
2. [Admin → Checkout setup](https://admin.6cubed.app/checkout-setup) → paste URL → **Save & reload StoryMagic**.
3. Verify: `./scripts/query_storybook_waitlist_summary.sh` → `Paid path: preorder live`.
4. Telegram: **`/revenue`** or **`/waitlist`**.

Or run locally: `./scripts/open-first-sale.sh` (opens Stripe + Checkout setup).

**One command:** `./scripts/storymagic-week-experiment.sh` — prints today’s tracked post URL + revenue status (copies URL on macOS).

## Traffic (pick one channel)

Post once with UTM:

```
https://storybook.6cubed.app?utm_source=meta&utm_medium=organic&utm_campaign=week_experiment_may28
```

Creative: 15s screen recording — type topic → preview pages → **Preorder now** CTA. After preview, **Copy link to share** turns friends into referral traffic (`ref_book` + share UTMs).

## Measure (all week)

| Signal | Where |
|--------|--------|
| `preorder_click` | GA4 (mark conversion) |
| `waitlist_signup` | GA4 + [admin Leads](https://admin.6cubed.app/leads) |
| Stripe Payment Link payments | Stripe Dashboard |
| Waitlist without pay | [Leads → Export CSV](https://admin.6cubed.app/leads) → email blast with same link |

## Success (5–7 days)

- **≥1 Stripe payment** on the Payment Link, or
- **≥10 `preorder_click`** with **≥3 waitlist** and CPA you’d repeat on paid ads

## If it works

1. Switch Payment Link to **live** mode; update URL on Checkout setup.
2. [Admin → Leads](https://admin.6cubed.app/leads) → **Copy preorder blast** to email waitlist (UTMs included).
3. Optional: add full checkout keys (`STORYBOOK_STRIPE_*`) for in-app Order + admin Orders.

## If it doesn’t

- Try price ($19.99 link) or hero copy only — swap URL in Checkout setup (no deploy).
- Review Leads UTMs — double down on the campaign that drove waitlist rows.

See also: [`FIRST-SALE.md`](FIRST-SALE.md), [`STORYMAGIC-ADS.md`](STORYMAGIC-ADS.md).
