import { RecentActivity } from "@/components/RecentActivity";
import { getUnifiedDeploymentFeed } from "@/lib/deployment-feed";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const items = await getUnifiedDeploymentFeed(120);

  return (
    <section className="animate-fade-in">
      <RecentActivity
        items={items}
        title="Deployment Activity Feed"
        subtitle="VPS rollouts (deploy.sh), per-app updates, and GHCR CI — unified"
      />
    </section>
  );
}
