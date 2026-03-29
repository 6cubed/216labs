import { getAllApps } from "@/lib/db";
import { dbRowToAppInfo, infrastructure } from "@/data/apps";
import { MetricCard } from "@/components/MetricCard";
import { InfraOverview } from "@/components/InfraOverview";
import { RecentActivity } from "@/components/RecentActivity";
import { getUnifiedDeploymentFeed } from "@/lib/deployment-feed";
import { AppsOverviewTable } from "@/components/AppsOverviewTable";
import { ProjectOverviewBanner } from "@/components/ProjectOverviewBanner";
import { getRunningServices } from "@/lib/docker";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const rows = getAllApps();
  const apps = rows.map(dbRowToAppInfo);
  const runningServices = await getRunningServices();
  const runningList = [...runningServices];
  const recentFeed = await getUnifiedDeploymentFeed(12);
  const enabledApps = new Set(
    apps.filter((a) => a.deployEnabled || a.id === "admin").map((a) => a.id)
  );
  const enabledCount = enabledApps.size;
  const totalCommits = apps.reduce((sum, a) => sum + a.totalCommits, 0);
  const renderedAtIso = new Date().toISOString();

  return (
    <>
      <section className="animate-fade-in mb-6">
        <ProjectOverviewBanner appCount={apps.length} renderedAtIso={renderedAtIso} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in">
        <MetricCard
          label="Applications"
          value={apps.length}
          sublabel={`${enabledCount} deploy-enabled`}
        />
        <MetricCard
          label="Monthly Cost"
          value={infrastructure.monthlyCost}
          sublabel={infrastructure.provider}
        />
        <MetricCard
          label="Total Commits"
          value={totalCommits}
          sublabel="Across all apps"
        />
      </section>

      <section className="animate-fade-in mt-8">
        <AppsOverviewTable apps={apps} runningServiceNames={runningList} />
      </section>

      <section className="animate-fade-in mt-8">
        <InfraOverview />
      </section>

      <section className="animate-fade-in mt-8">
        <RecentActivity items={recentFeed} />
      </section>
    </>
  );
}
