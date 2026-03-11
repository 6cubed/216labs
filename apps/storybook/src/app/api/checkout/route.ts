import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { v4 as uuidv4 } from "uuid";
import { getBook, createOrder } from "@/lib/db";

function getStripe(): Stripe {
  const key = process.env.STORYBOOK_STRIPE_SECRET_KEY;
  if (!key) throw new Error("STORYBOOK_STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { bookId: string };
    const { bookId } = body;

    if (!bookId) {
      return NextResponse.json({ error: "bookId is required" }, { status: 400 });
    }

    const book = getBook(bookId);
    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 });
    }

    const stripe = getStripe();
    const origin =
      req.headers.get("origin") ??
      `https://${req.headers.get("host") ?? "storybook.agimemes.com"}`;

    const priceCents =
      parseInt(process.env.STORYBOOK_BOOK_PRICE_CENTS ?? "2499", 10) || 2499;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceCents,
            product_data: {
              name: `"${book.title}" — Printed Children's Storybook`,
              description: `A personalised ${book.pages.length}-page colour storybook${book.childName ? ` for ${book.childName}` : ""}. Professionally printed and shipped to your door.`,
              images: [],
            },
          },
          quantity: 1,
        },
      ],
      shipping_address_collection: {
        allowed_countries: ["US", "CA", "GB", "AU", "NZ", "IE", "DE", "FR", "NL", "SE", "NO", "DK"],
      },
      metadata: { bookId, title: book.title },
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?cancelled=true`,
    });

    const orderId = uuidv4();
    createOrder({
      id: orderId,
      bookId,
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
