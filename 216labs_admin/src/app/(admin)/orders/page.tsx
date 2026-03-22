import { fetchStorybookOrders } from "@/lib/storybook";
import { fetchValentineOrders } from "@/lib/valentine";
import { OrdersSection } from "@/components/OrdersSection";
import { ValentineOrdersSection } from "@/components/ValentineOrdersSection";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [storybookOrders, valentineOrders] = await Promise.all([
    fetchStorybookOrders(),
    fetchValentineOrders(),
  ]);

  const valentineInternalConfigured = Boolean(process.env.VALENTINE_INTERNAL_URL);

  return (
    <section className="animate-fade-in space-y-0">
      <OrdersSection orders={storybookOrders} />
      <ValentineOrdersSection
        orders={valentineOrders}
        internalUrlConfigured={valentineInternalConfigured}
      />
    </section>
  );
}
