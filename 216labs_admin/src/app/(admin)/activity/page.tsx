import { RecentActivity } from "@/components/RecentActivity";
import { getRecentDeploymentActivity } from "@/lib/db";
import { buildRecentActivityFeed } from "@/lib/recent-activity";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const rows = getRecentDeploymentActivity(100);
  const items = buildRecentActivityFeed(
    rows.map((row) => ({
      id: row.id,
      name: row.name,
      lastDeployedAt: row.last_deployed_at,
    })),
  );

  return (
    <section className="animate-fade-in">
      <RecentActivity
        items={items}
        title="Deployment Activity Feed"
        subtitle="Most recent deploy events across all apps"
      />
    </section>
  );
}
