import { checkoutDemo } from "@/lib/orders";
import { isAppError } from "@216labs/errors";
import { nextErrorResponse } from "@216labs/errors/next";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function checkAuth(request: Request): boolean {
  const key = process.env.AGENTCART_API_KEY?.trim();
  if (!key) return true;
  const auth = request.headers.get("authorization") || "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === key;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "expected_object" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const sku = typeof o.sku === "string" ? o.sku.trim() : "";
  const quantity = typeof o.quantity === "number" ? o.quantity : 1;
  const idempotencyKey = typeof o.idempotencyKey === "string" ? o.idempotencyKey.trim() : undefined;
  const buyerRef = typeof o.buyerRef === "string" ? o.buyerRef.trim() : undefined;

  if (!sku) {
    return NextResponse.json({ ok: false, error: "missing_sku" }, { status: 400 });
  }

  try {
    const { order, reused } = checkoutDemo({ sku, quantity, idempotencyKey, buyerRef });
    return NextResponse.json(
      {
        ok: true,
        orderId: order.orderId,
        sku: order.sku,
        quantity: order.quantity,
        lineTotal: order.lineTotal,
        currency: order.currency,
        createdAt: order.createdAt,
        idempotentReplay: reused,
        message: reused
          ? "Same idempotency key as prior request—returning existing demo order."
          : "Demo order recorded (no payment).",
      },
      { status: 200 },
    );
  } catch (e) {
    if (isAppError(e)) {
      return nextErrorResponse(e);
    }
    return NextResponse.json({ ok: false, error: "checkout_failed" }, { status: 500 });
  }
}
