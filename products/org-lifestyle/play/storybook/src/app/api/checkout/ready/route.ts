import { NextResponse } from "next/server";

/** Public probe: whether Stripe checkout can run (keys in admin Env). */
export async function GET() {
  const ready = Boolean(process.env.STORYBOOK_STRIPE_SECRET_KEY?.trim());
  return NextResponse.json({
    ready,
    message: ready
      ? undefined
      : "Printed book checkout is being enabled. Your story is saved — payment opens once Stripe is configured in admin Env.",
  });
}
