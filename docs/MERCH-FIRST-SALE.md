# Merch — first storefront sale

The catalog UI is live at [merch.6cubed.app](https://merch.6cubed.app). Buy buttons stay on **StoryMagic fallback** until you paste a real storefront URL.

## CEO path (~15 min)

1. **Printful** (or similar) — create a store, add SKUs that match the catalog in `products/org-growth/ads/merch/src/data/products.ts` (or swap names later).
2. Copy the **public storefront URL** (e.g. `https://your-store.printful.me/`).
3. [Admin → Checkout setup](https://admin.6cubed.app/checkout-setup) → **Merch storefront** → paste URL → **Save & reload merch**.
4. Verify: open [merch.6cubed.app](https://merch.6cubed.app) → any product → **Buy** opens your store (not StoryMagic).

Telegram: **`/merch`** for catalog + live status.

The **Checkout live now** band on the merch homepage reads StoryMagic `/api/checkout/ready` in the browser — when a Payment Link is saved in admin, it switches to **Preorder StoryMagic — $24.99** with `utm_source=merch` (no merch image rebuild).

## Catalog (designed SKUs)

| Item | From |
|------|------|
| 6³ wordmark tee | $28 |
| 216Labs stack tee | $28 |
| Production-grade vibes hoodie | $64 |
| Cube snapback | $32 |
| Sticker sheet | $12 |
| Canvas tote | $22 |
| Enamel camp mug | $18 |
| Crew socks | $16 |

## Verify

```bash
./scripts/query_merch_summary.sh
./scripts/check-revenue-env-http.sh   # [Merch] storefront URL appears configured
```

See also: [`REVENUE-ENV.md`](REVENUE-ENV.md), [`FIRST-SALE.md`](FIRST-SALE.md) (StoryMagic is still the fastest first dollar).
