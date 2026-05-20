import { fetchStorybookOrders } from "@/lib/storybook";
import { fetchValentineOrders } from "@/lib/valentine";
import { OrdersSection } from "@/components/OrdersSection";
import { ValentineOrdersSection } from "@/components/ValentineOrdersSection";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [storybookOrders, storybookPrintLeads, valentineOrders] = await Promise.all([
    fetchStorybookOrders(),
    fetchStorybookPrintLeads(),
    fetchValentineOrders(),
  ]);

  const valentineInternalConfigured = Boolean(process.env.VALENTINE_INTERNAL_URL);

  return (
    <section className="animate-fade-in space-y-0">
      <OrdersSection orders={storybookOrders} />
      <StorybookPrintLeadsSection leads={storybookPrintLeads} />
      <ValentineOrdersSection
        orders={valentineOrders}
        internalUrlConfigured={valentineInternalConfigured}
      />
    </section>
  );
}
