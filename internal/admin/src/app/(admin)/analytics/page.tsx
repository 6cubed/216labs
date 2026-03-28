import { getAllApps } from "@/lib/db";
import { getAppAnalyticsMap } from "@/lib/db";
import { dbRowToAppInfo } from "@/data/apps";
import { AnalyticsTable } from "@/components/AnalyticsTable";

export const dynamic = "force-dynamic";

const GA4_ID_RE = /^G-[A-Z0-9]+$/;

function ga4ReportsHref(propertyId: string | undefined): string {
  const pid = propertyId?.trim();
  if (pid && /^\d+$/.test(pid)) {
    return `https://analytics.google.com/analytics/web/#/p${pid}/reports/intelligenthome`;
  }
  return "https://analytics.google.com/analytics/web/";
}

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

  const gaRaw = process.env.GA_MEASUREMENT_ID?.trim();
  const gaConfigured = Boolean(gaRaw && GA4_ID_RE.test(gaRaw));
  const ga4PropertyRaw = process.env.GA4_PROPERTY_ID?.trim();
  const reportsHref = ga4ReportsHref(ga4PropertyRaw);

  return (
    <section className="animate-fade-in space-y-8">
      <div className="rounded-lg border border-border bg-card/40 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">
          Web traffic (Google Analytics 4)
        </h2>
        <p className="text-sm text-muted mb-4 max-w-2xl">
          All public app containers receive{" "}
          <code className="text-xs bg-muted/50 px-1 py-0.5 rounded">GA_MEASUREMENT_ID</code> from
          the host environment (docker compose). Next.js apps load gtag from the root layout;
          Flask and Vite bundles inject the same stream in HTML. Reports and exploration live in
          Google&apos;s UI — this panel only shows configuration status and a shortcut.
        </p>
        <dl className="grid gap-2 text-sm sm:grid-cols-[140px_1fr] sm:gap-x-4 sm:gap-y-2">
          <dt className="text-muted">Measurement ID</dt>
          <dd className="font-mono text-foreground">
            {gaConfigured && gaRaw ? gaRaw : "— (set GA_MEASUREMENT_ID on the host .env)"}
          </dd>
          <dt className="text-muted">Property ID (optional)</dt>
          <dd className="font-mono text-foreground">
            {ga4PropertyRaw && /^\d+$/.test(ga4PropertyRaw)
              ? ga4PropertyRaw
              : "— (optional: GA4_PROPERTY_ID on admin service for deep links)"}
          </dd>
        </dl>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={reportsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-accent px-3 py-2 text-sm font-medium text-accent-foreground hover:opacity-90"
          >
            Open GA4 reports
          </a>
          <span className="text-xs text-muted self-center">
            Env keys are also listed under Environment (GA_MEASUREMENT_ID, GA4_PROPERTY_ID).
          </span>
        </div>
      </div>

      <div>
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
      </div>
    </section>
  );
}
