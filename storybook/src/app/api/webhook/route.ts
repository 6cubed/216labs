import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateOrderStatus } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.STORYBOOK_STRIPE_SECRET_KEY;
  if (!key) throw new Error("STORYBOOK_STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STORYBOOK_STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[webhook] STORYBOOK_STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook verification failed";
    console.error("[webhook] Signature verification failed:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    const customerEmail =
      session.customer_details?.email ?? null;
    const customerName =
      session.customer_details?.name ?? null;

    const shipping = session.shipping_details?.address;
    const shippingAddress = shipping
      ? [
          shipping.line1,
          shipping.line2,
          shipping.city,
          shipping.state,
          shipping.postal_code,
          shipping.country,
        ]
          .filter(Boolean)
          .join(", ")
      : null;

    updateOrderStatus(session.id, "paid", customerEmail ?? undefined, customerName ?? undefined, shippingAddress ?? undefined);

    console.log(`[webhook] Order paid — session ${session.id}, book ${session.metadata?.bookId}`);
  }

  return NextResponse.json({ received: true });
}
