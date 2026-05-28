import { NextResponse } from "next/server";

const ADMIN_CHECKOUT_SETUP_URL = "https://admin.6cubed.app/checkout-setup";

/** Server-side Checkout Sessions only need secret + webhook; publishable is optional (no client Stripe.js yet). */
const REQUIRED_KEYS = [
  "STORYBOOK_STRIPE_SECRET_KEY",
  "STORYBOOK_STRIPE_WEBHOOK_SECRET",
] as const;

const OPTIONAL_KEYS = ["NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY"] as const;

/** Public probe: whether Stripe checkout can run (keys in admin Env). */
export async function GET() {
  const missingKeys = REQUIRED_KEYS.filter((k) => !process.env[k]?.trim());
  const optionalUnset = OPTIONAL_KEYS.filter((k) => !process.env[k]?.trim());
  const ready = missingKeys.length === 0;
  const preorderConfigured = Boolean(
    process.env.NEXT_PUBLIC_STORYBOOK_PREORDER_URL?.trim()
  );
  const priceCents =
    parseInt(process.env.STORYBOOK_BOOK_PRICE_CENTS ?? "2499", 10) || 2499;
  const priceUsd = (priceCents / 100).toFixed(2);

  return NextResponse.json({
    ready,
    preorderConfigured,
    priceCents,
    priceUsd,
    setupUrl: ready ? undefined : ADMIN_CHECKOUT_SETUP_URL,
    missingKeys: ready ? undefined : missingKeys,
    optionalUnset: ready && optionalUnset.length > 0 ? optionalUnset : undefined,
    message: ready
      ? undefined
      : preorderConfigured
        ? "Preorder is open via Payment Link. In-app Stripe checkout is still being enabled."
        : "Printed checkout isn't open yet. Your story is saved — leave your email below and we'll notify you when ordering is live.",
    operatorHint: ready
      ? undefined
      : preorderConfigured
        ? "Optional: add STORYBOOK_STRIPE_* in admin Checkout setup for in-app checkout + Orders."
        : "Set STORYBOOK_STRIPE_* or NEXT_PUBLIC_STORYBOOK_PREORDER_URL in admin Checkout setup.",
  });
}
