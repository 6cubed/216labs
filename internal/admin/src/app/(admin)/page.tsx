import { getAllApps, getAllEnvVars, getCronRunnerState, getDb } from "@/lib/db";
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
  resolveErrorsFeedHref,
} from "@/lib/admin-errors";
import {
  countClientErrorEventsByAppSinceHours,
  countClientErrorEventsSinceHours,
  topReportedErrorAppSinceHours,
} from "@/lib/client-error-store";
import {
  parseRevenueCronSnapshot,
  REVENUE_CRON_STATE_KEY,
  storybookPreorderConfigured,
} from "@/lib/revenue-readiness";
import { fetchStorybookPrintLeads } from "@/lib/storybook";
import {
  getStackHealthSnapshot,
  stackHealthMetric,
} from "@/lib/stack-health";

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
  const topReported = topReportedErrorAppSinceHours(getDb(), 24);
  const runtimeFailedAppIds = listAppsWithRuntimeFailure();
  const topRuntimeId = runtimeFailedAppIds[0];
  let errorSublabel = "No signals in last 24h";
  if (errorSignals24h > 0) {
    errorSublabel = `${reportedErrors24h} reported · ${runtimeFailures24h} runtime (24h)`;
    if (topReported) {
      errorSublabel += ` · top: ${topReported.appId} (${topReported.count})`;
    } else if (topRuntimeId) {
      errorSublabel += ` · ${topRuntimeId} (RT)`;
    }
  }
  const errorHref = resolveErrorsFeedHref(getDb());
  const errorCounts24h = countClientErrorEventsByAppSinceHours(getDb(), 24);
  const renderedAtIso = new Date().toISOString();
  const envMap = new Map(getAllEnvVars().map((r) => [r.key, (r.value ?? "").trim()]));
  const storyPreorder = storybookPreorderConfigured(envMap);
  const revenueCronParsed = parseRevenueCronSnapshot(
    getCronRunnerState(REVENUE_CRON_STATE_KEY)
  );
  const storyCron = revenueCronParsed?.results.find((r) => r.id === "storybook");
  const storyCheckoutReady = storyCron?.ready === true;
  const storyPreorderLive =
    storyPreorder || storyCron?.preorderConfigured === true;

  const storybookWaitlist = await fetchStorybookPrintLeads();
  const revenueCron = revenueCronParsed;
  const revenueMetricValue = storyCheckoutReady
    ? "Checkout open"
    : storyPreorderLive
      ? "Preorder live"
      : revenueCron
        ? revenueCron.issues > 0
          ? `${revenueCron.issues} edge issue(s)`
          : "Needs keys"
        : "—";
  const waitlistPart =
    storybookWaitlist.length > 0
      ? `${storybookWaitlist.length} StoryMagic waitlist`
      : storyPreorderLive
        ? "Full checkout → Checkout setup"
        : "StoryMagic keys → Checkout setup";
  const revenueMetricSub =
    revenueCron != null
      ? `${waitlistPart} · cron ${revenueCron.at.replace("T", " ").slice(0, 16)} UTC`
      : waitlistPart;
  const stackSnap = getStackHealthSnapshot();
  const stackMetric = stackHealthMetric(stackSnap);

  return (
    <>
      <section className="animate-fade-in mb-6">
        <ProjectOverviewBanner appCount={apps.length} renderedAtIso={renderedAtIso} />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 animate-fade-in">
        <MetricCard
          label="Applications"
          value={apps.length}
          sublabel={`${enabledCount} deploy-enabled`}
        />
        <MetricCard
          label="Error signals"
          value={errorSignals24h}
          sublabel={errorSublabel}
          href={errorHref}
        />
        <MetricCard
          label="Stack / edge"
          value={stackMetric.value}
          sublabel={stackMetric.sublabel}
          href="/cron"
        />
        <MetricCard
          label="Revenue / checkout"
          value={revenueMetricValue}
          sublabel={revenueMetricSub}
          href="/checkout-setup"
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
