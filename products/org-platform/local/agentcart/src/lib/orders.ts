import { randomBytes } from "crypto";
import { getProduct } from "./catalog";

export type DemoOrder = {
  orderId: string;
  sku: string;
  quantity: number;
  lineTotal: number;
  currency: "USD";
  createdAt: string;
  buyerRef?: string;
};

const idempotency = new Map<string, string>();
const orders = new Map<string, DemoOrder>();

function newOrderId() {
  return `ord_demo_${randomBytes(12).toString("hex")}`;
}

export function checkoutDemo(input: {
  sku: string;
  quantity: number;
  idempotencyKey?: string;
  buyerRef?: string;
}): { order: DemoOrder; reused: boolean } {
  const { sku, quantity, idempotencyKey, buyerRef } = input;
  if (idempotencyKey) {
    const existing = idempotency.get(idempotencyKey);
    if (existing) {
      const o = orders.get(existing);
      if (o) return { order: o, reused: true };
    }
  }

  const product = getProduct(sku);
  if (!product) {
    throw new Error("unknown_sku");
  }
  if (!product.inStock) {
    throw new Error("out_of_stock");
  }
  const qty = Math.max(1, Math.min(99, Math.floor(quantity || 1)));
  const lineTotal = product.price * qty;

  const orderId = newOrderId();
  const order: DemoOrder = {
    orderId,
    sku,
    quantity: qty,
    lineTotal,
    currency: "USD",
    createdAt: new Date().toISOString(),
    buyerRef,
  };
  orders.set(orderId, order);
  if (idempotencyKey) idempotency.set(idempotencyKey, orderId);

  return { order, reused: false };
}
