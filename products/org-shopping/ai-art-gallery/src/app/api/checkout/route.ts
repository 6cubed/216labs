import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { getPrint, priceForPrint } from "@/lib/catalog";
import { createOrder } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.AIART_STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("AIART_STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { printId?: string };
    const printId = body.printId?.trim();
    if (!printId) {
      return NextResponse.json({ error: "printId is required" }, { status: 400 });
    }

    const print = getPrint(printId);
    if (!print) {
      return NextResponse.json({ error: "Print not found" }, { status: 404 });
    }

    const stripe = getStripe();
    const origin =
      req.headers.get("origin") ?? `https://${req.headers.get("host") ?? "aiart.6cubed.app"}`;

    const priceCents = priceForPrint(print);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: `${print.title} — museum print`,
              description: `${print.medium}. ${print.dimensions}. Ships flat in protective packaging.`,
              images: [`${origin}${print.imageSrc}`],
            },
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: [
          "US",
          "CA",
          "GB",
          "AU",
          "NZ",
          "IE",
          "DE",
          "FR",
          "NL",
          "SE",
          "NO",
          "DK",
          "CH",
          "AT",
        ],
      },
      phone_number_collection: { enabled: true },
      metadata: { printId, title: print.title },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=1`,
    });

    const orderId = uuidv4();
    createOrder({
      id: orderId,
      printId,
      stripeSessionId: session.id,
      status: "pending",
      customerEmail: null,
      customerName: null,
      shippingAddress: null,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[aiart checkout]", message);
    const status = message.includes("AIART_STRIPE_SECRET_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
