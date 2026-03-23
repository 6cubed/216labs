import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { getCard, createOrder } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.VALENTINE_STRIPE_SECRET_KEY;
  if (!key) throw new Error("VALENTINE_STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { cardId: string };
    const { cardId } = body;

    if (!cardId) {
      return NextResponse.json({ error: "cardId is required" }, { status: 400 });
    }

    const card = getCard(cardId);
    if (!card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const stripe = getStripe();
    const origin =
      req.headers.get("origin") ??
      `https://${req.headers.get("host") ?? "valentine.6cubed.app"}`;

    const priceCents =
      parseInt(process.env.VALENTINE_CARD_PRICE_CENTS ?? "1999", 10) || 1999;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: `"${card.title}" — Printed Valentine's Card`,
              description: `A personalised AI-designed Valentine's card${card.recipientName ? ` for ${card.recipientName}` : ""}. Professionally printed and shipped.`,
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "NL", "SE", "NO", "DK"],
      },
      metadata: { cardId, title: card.title },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=true`,
    });

    const orderId = uuidv4();
    createOrder({
      id: orderId,
      cardId,
      stripeSessionId: session.id,
      status: "pending",
      customerEmail: null,
      customerName: null,
      shippingAddress: null,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[checkout]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
