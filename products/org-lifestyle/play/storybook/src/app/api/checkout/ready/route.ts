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
      : "Printed checkout needs Stripe keys in admin Env (see docs/FIRST-SALE.md). Your story is saved — add keys, redeploy storybook, then Order.",
  });
}
