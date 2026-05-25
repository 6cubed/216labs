import { NextResponse } from "next/server";

const ADMIN_ENV_URL = "https://admin.6cubed.app/env";

const REQUIRED_KEYS = [
  "STORYBOOK_STRIPE_SECRET_KEY",
  "STORYBOOK_STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY",
] as const;

/** Public probe: whether Stripe checkout can run (keys in admin Env). */
export async function GET() {
  const missingKeys = REQUIRED_KEYS.filter((k) => !process.env[k]?.trim());
  const ready = missingKeys.length === 0;

  return NextResponse.json({
    ready,
    setupUrl: ready ? undefined : ADMIN_ENV_URL,
    missingKeys: ready ? undefined : missingKeys,
    message: ready
      ? undefined
      : "Printed checkout isn't open yet. Your story is saved — leave your email below and we'll notify you when ordering is live.",
    operatorHint: ready
      ? undefined
      : "Set STORYBOOK_STRIPE_* in admin Env (docs/FIRST-SALE.md); save recreates the storybook container on this host.",
  });
}
