import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { updateOrderStatus, getBook } from "@/lib/db";

async function sendOrderEmail(session: Stripe.Checkout.Session, bookTitle: string) {
  const resendKey = process.env.STORYBOOK_RESEND_API_KEY;
  const adminEmail = process.env.STORYBOOK_ADMIN_EMAIL;
  if (!resendKey || !adminEmail) return;

  const shipping = session.shipping_details?.address;
  const shippingText = shipping
    ? [shipping.line1, shipping.line2, shipping.city, shipping.state, shipping.postal_code, shipping.country]
        .filter(Boolean).join(", ")
    : "Not provided";

  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.STORYBOOK_FROM_EMAIL ?? "StoryMagic <orders@resend.dev>",
      to: adminEmail,
      subject: `📚 New order: "${bookTitle}"`,
      html: `
        <h2>New StoryMagic order paid</h2>
        <table style="border-collapse:collapse;width:100%;max-width:500px">
          <tr><td style="padding:8px 0;color:#666;width:140px">Book</td><td><strong>${bookTitle}</strong></td></tr>
          <tr><td style="padding:8px 0;color:#666">Customer</td><td>${session.customer_details?.name ?? "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Email</td><td>${session.customer_details?.email ?? "—"}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Ship to</td><td>${shippingText}</td></tr>
          <tr><td style="padding:8px 0;color:#666">Session</td><td style="font-family:monospace;font-size:12px">${session.id}</td></tr>
        </table>
        <p style="margin-top:24px">
          <a href="https://admin.agimemes.com" style="background:#7C3AED;color:white;padding:10px 20px;border-radius:8px;text-decoration:none">
            View in admin dashboard →
          </a>
        </p>
      `,
    }),
  }).catch((err) => console.error("[webhook] email failed:", err));
}

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

    const bookId = session.metadata?.bookId;
    const book = bookId ? getBook(bookId) : null;
    await sendOrderEmail(session, book?.title ?? "Unknown book");

    console.log(`[webhook] Order paid — session ${session.id}, book ${bookId}`);
  }

  return NextResponse.json({ received: true });
}
