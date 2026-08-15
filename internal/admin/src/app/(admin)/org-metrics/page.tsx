import { MetricCard } from "@/components/MetricCard";
import { getDb } from "@/lib/db";
import { getOrgMetrics } from "@/lib/org-metrics";

export const dynamic = "force-dynamic";

type OrgMetrics = ReturnType<typeof getOrgMetrics>;

function fmt(v: number | undefined): string {
  return v == null ? "—" : String(v);
}

export default async function OrgMetricsPage() {
  let m: OrgMetrics | null = null;
  let err: string | null = null;
  try {
    m = getOrgMetrics(getDb());
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }

  if (!m) {
    return (
      <section className="animate-fade-in space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Org metrics</h2>
        <p className="text-sm text-muted">
          Unable to load metrics. {err ? <span className="font-mono">{err}</span> : null}
        </p>
      </section>
    );
  }

  return (
    <section className="animate-fade-in space-y-8">
      <div className="rounded-lg border border-border bg-card/40 p-4 sm:p-5">
        <h2 className="text-lg font-semibold text-foreground mb-1">Org metrics</h2>
        <p className="text-sm text-muted max-w-2xl">
          Investor-style snapshot of velocity, surface area, and reliability signals. This is
          intentionally simple: “are we compounding or drowning?”
        </p>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[160px_1fr] sm:gap-x-4 sm:gap-y-2">
          <dt className="text-muted">Generated</dt>
          <dd className="font-mono text-foreground">{m.generatedAtUtc}</dd>
          <dt className="text-muted">Repo root</dt>
          <dd className="font-mono text-foreground">{m.repo.root}</dd>
          <dt className="text-muted">Head</dt>
          <dd className="font-mono text-foreground">{m.repo.headShort ?? "—"}</dd>
        </dl>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Commits (total)" value={fmt(m.repo.commitsTotal)} />
        <MetricCard label="Commits (7d)" value={fmt(m.repo.commits7d)} />
        <MetricCard label="Commits (30d)" value={fmt(m.repo.commits30d)} />
        <MetricCard
          label="Manifests"
          value={fmt(m.surface.manifestTotal)}
          sublabel={`${fmt(m.surface.manifestProducts)} products · ${fmt(
            m.surface.manifestInternal
          )} internal`}
        />
        <MetricCard label="Errors (24h)" value={fmt(m.quality.errors24h)} href="/errors" />
        <MetricCard
          label="Human visitors (7d)"
          value={fmt(m.quality.edgeUniques7d)}
          sublabel={`${fmt(m.quality.edgeBots30d)} bots blocked (30d)`}
          href="/cron"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top error apps (24h)</h3>
          {m.quality.topErrorApps24h?.length ? (
            <ul className="space-y-1 text-sm">
              {m.quality.topErrorApps24h.map((r) => (
                <li key={r.appId} className="flex items-center justify-between">
                  <span className="font-mono text-foreground">{r.appId}</span>
                  <span className="text-muted">{r.n}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-3">
            Top apps by human visitors (7d)
          </h3>
          {m.quality.topEdgeApps7d?.length ? (
            <ul className="space-y-1 text-sm">
              {m.quality.topEdgeApps7d.map((r) => (
                <li key={r.appId} className="flex items-center justify-between">
                  <span className="font-mono text-foreground">{r.appId}</span>
                  <span className="text-muted">{r.uniques}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">—</p>
          )}
        </div>
      </div>

      {m.notes.length ? (
        <div className="rounded-lg border border-border bg-card/40 p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-foreground mb-2">Notes</h3>
          <ul className="list-disc list-inside text-sm text-muted space-y-1">
            {m.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

