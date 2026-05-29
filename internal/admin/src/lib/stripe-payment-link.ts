/** Create a Stripe Payment Link via REST (no stripe npm dep in admin). */
export async function createStripePaymentLinkForStorybook(
  secretKey: string,
  priceCents: number
): Promise<string> {
  const params = new URLSearchParams();
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", "usd");
  params.set(
    "line_items[0][price_data][product_data][name]",
    "StoryMagic — Printed Children's Hardcover"
  );
  params.set("line_items[0][price_data][unit_amount]", String(priceCents));
  params.set("metadata[product]", "storymagic_preorder");

  const res = await fetch("https://api.stripe.com/v1/payment_links", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const data = (await res.json()) as {
    url?: string;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Stripe HTTP ${res.status}`);
  }
  const url = data.url?.trim();
  if (!url) {
    throw new Error("Stripe did not return a payment link URL");
  }
  return url;
}
