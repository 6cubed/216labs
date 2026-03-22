/** Avoid hanging the admin Orders page when HeartInk is down or misconfigured. */
const VALENTINE_FETCH_TIMEOUT_MS = 10_000;

export interface ValentineOrder {
  id: string;
  cardId: string;
  stripeSessionId: string;
  status: "pending" | "paid" | "fulfilled";
  customerEmail: string | null;
  customerName: string | null;
  shippingAddress: string | null;
  createdAt: string;
  cardTitle: string;
  cardRecipient: string;
}

export async function fetchValentineOrders(): Promise<ValentineOrder[]> {
  const base = process.env.VALENTINE_INTERNAL_URL;
  if (!base) return [];

  try {
    const res = await fetch(`${base}/api/admin/orders`, {
      headers: {
        ...(process.env.VALENTINE_ADMIN_TOKEN
          ? { Authorization: `Bearer ${process.env.VALENTINE_ADMIN_TOKEN}` }
          : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return (await res.json()) as ValentineOrder[];
  } catch {
    return [];
  }
}

export async function patchValentineOrder(
  orderId: string,
  status: ValentineOrder["status"]
): Promise<void> {
  const base = process.env.VALENTINE_INTERNAL_URL;
  if (!base) return;

  await fetch(`${base}/api/admin/orders`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.VALENTINE_ADMIN_TOKEN
        ? { Authorization: `Bearer ${process.env.VALENTINE_ADMIN_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ orderId, status }),
    signal: AbortSignal.timeout(VALENTINE_FETCH_TIMEOUT_MS),
  });
}
