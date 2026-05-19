import { getAllApps } from "@/lib/db";
import { dbRowToAppInfo, infrastructure } from "@/data/apps";
import { MetricCard } from "@/components/MetricCard";
import { InfraOverview } from "@/components/InfraOverview";
import { RecentActivity } from "@/components/RecentActivity";
import { getUnifiedDeploymentFeed } from "@/lib/deployment-feed";
import { AppsOverviewTable } from "@/components/AppsOverviewTable";
import { ProjectOverviewBanner } from "@/components/ProjectOverviewBanner";
import { getRunningServices } from "@/lib/docker";
import {
  getErrorSignalCount24h,
  listAppsWithRuntimeFailure,
} from "@/lib/admin-errors";
import {
  countClientErrorEventsByAppSinceHours,
  countClientErrorEventsSinceHours,
} from "@/lib/client-error-store";
import { getDb } from "@/lib/db";

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
  const errorSignals24h = getErrorSignalCount24h();
  const reportedErrors24h = countClientErrorEventsSinceHours(getDb(), 24);
  const runtimeFailures24h = Math.max(0, errorSignals24h - reportedErrors24h);
  const errorSublabel =
    errorSignals24h > 0
      ? `${reportedErrors24h} reported · ${runtimeFailures24h} runtime (24h)`
      : "No signals in last 24h";
  const errorCounts24h = countClientErrorEventsByAppSinceHours(getDb(), 24);
  const runtimeFailedAppIds = listAppsWithRuntimeFailure();
  const renderedAtIso = new Date().toISOString();

  return (
    <>
      <section className="animate-fade-in mb-6">
        <ProjectOverviewBanner appCount={apps.length} renderedAtIso={renderedAtIso} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fade-in">
        <MetricCard
          label="Applications"
          value={apps.length}
          sublabel={`${enabledCount} deploy-enabled`}
        />
        <MetricCard
          label="Error signals"
          value={errorSignals24h}
          sublabel={errorSublabel}
          href="/errors"
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
        <AppsOverviewTable
          apps={apps}
          runningServiceNames={runningList}
          errorCounts24h={errorCounts24h}
          runtimeFailedAppIds={runtimeFailedAppIds}
        />
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
