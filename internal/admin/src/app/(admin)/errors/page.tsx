import { ErrorMonitorSection } from "@/components/ErrorMonitorSection";
import { getAdminErrorFeed } from "@/lib/admin-errors";

export const dynamic = "force-dynamic";

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ app?: string }>;
}) {
  const { app } = await searchParams;
  const appFilter = app?.trim() || undefined;
  const items = await getAdminErrorFeed(80, appFilter);

  return (
    <section className="animate-fade-in">
      <ErrorMonitorSection items={items} appFilter={appFilter} />
    </section>
  );
}
