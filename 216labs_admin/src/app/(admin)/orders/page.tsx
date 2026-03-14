import { fetchStorybookOrders } from "@/lib/storybook";
import { OrdersSection } from "@/components/OrdersSection";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const storybookOrders = await fetchStorybookOrders();

  return (
    <section className="animate-fade-in">
      <OrdersSection orders={storybookOrders} />
    </section>
  );
}
