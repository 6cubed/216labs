/** Avoid hanging the admin Orders page when Storybook is down or misconfigured. */
const STORYBOOK_FETCH_TIMEOUT_MS = 10_000;

export interface StorybookOrder {
  id: string;
  bookId: string;
  stripeSessionId: string;
  status: "pending" | "paid" | "fulfilled";
  customerEmail: string | null;
  customerName: string | null;
  shippingAddress: string | null;
  createdAt: string;
  bookTitle: string;
  bookChildName: string;
  bookAge: number;
}

export async function fetchStorybookOrders(): Promise<StorybookOrder[]> {
  const base = process.env.STORYBOOK_INTERNAL_URL;
  if (!base) return [];

  try {
    const res = await fetch(`${base}/api/admin/orders`, {
      headers: {
        ...(process.env.STORYBOOK_ADMIN_TOKEN
          ? { Authorization: `Bearer ${process.env.STORYBOOK_ADMIN_TOKEN}` }
          : {}),
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    return (await res.json()) as StorybookOrder[];
  } catch {
    return [];
  }
}

export async function patchStorybookOrder(
  orderId: string,
  status: StorybookOrder["status"]
): Promise<void> {
  const base = process.env.STORYBOOK_INTERNAL_URL;
  if (!base) return;

  await fetch(`${base}/api/admin/orders`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.STORYBOOK_ADMIN_TOKEN
        ? { Authorization: `Bearer ${process.env.STORYBOOK_ADMIN_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({ orderId, status }),
    signal: AbortSignal.timeout(STORYBOOK_FETCH_TIMEOUT_MS),
  });
}
