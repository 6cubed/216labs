import { getAllApps } from "@/lib/db";
import { getAppAnalyticsMap } from "@/lib/db";
import { dbRowToAppInfo } from "@/data/apps";
import { AnalyticsTable } from "@/components/AnalyticsTable";

export const dynamic = "force-dynamic";

/** Weighted score to rank "most promising" apps: visits + conversions + revenue proxy. */
function computePromiseScore(
  visits: number,
  conversions: number,
  revenue: number,
  maxVisits: number,
  maxConversions: number,
  maxRevenue: number
): number {
  const n = (v: number, m: number) => (m > 0 ? v / m : 0);
  return (
    0.35 * n(visits, maxVisits) +
    0.35 * n(conversions, maxConversions) +
    0.3 * n(revenue, maxRevenue)
  );
}

export default async function AnalyticsPage() {
  const rows = getAllApps();
  const apps = rows.map(dbRowToAppInfo);
  const analyticsMap = getAppAnalyticsMap();

  const withMetrics = apps.map((app) => {
    const a = analyticsMap[app.id] ?? {
      visits_30d: 0,
      conversions_30d: 0,
      revenue_proxy_30d: 0,
      notes: null,
      updated_at: null,
    };
    return {
      app,
      visits_30d: a.visits_30d,
      conversions_30d: a.conversions_30d,
      revenue_proxy_30d: a.revenue_proxy_30d,
      notes: a.notes,
      updated_at: a.updated_at,
    };
  });

  const maxVisits = Math.max(1, ...withMetrics.map((m) => m.visits_30d));
  const maxConversions = Math.max(1, ...withMetrics.map((m) => m.conversions_30d));
  const maxRevenue = Math.max(1, ...withMetrics.map((m) => m.revenue_proxy_30d));

  const withScore = withMetrics.map((m) => ({
    ...m,
    promiseScore: computePromiseScore(
      m.visits_30d,
      m.conversions_30d,
      m.revenue_proxy_30d,
      maxVisits,
      maxConversions,
      maxRevenue
    ),
  }));

  const sorted = [...withScore].sort((a, b) => b.promiseScore - a.promiseScore);

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Portfolio analytics
        </h2>
        <p className="text-xs text-muted max-w-md">
          Site visits, conversions, and revenue proxies (30d). Edit to update;
          used to rank most promising apps.
        </p>
      </div>
      <AnalyticsTable rows={sorted} />
    </section>
  );
}
