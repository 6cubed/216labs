import { ErrorMonitorSection } from "@/components/ErrorMonitorSection";
import { getAdminErrorFeed } from "@/lib/admin-errors";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const items = await getAdminErrorFeed(80);

  return (
    <section className="animate-fade-in">
      <ErrorMonitorSection items={items} />
    </section>
  );
}
