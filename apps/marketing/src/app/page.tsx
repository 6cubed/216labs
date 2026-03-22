import {
  campaigns,
  campaignsByParentApp,
  kindLabel,
  type Campaign,
  type CampaignKind,
} from '@/data/campaign-registry'

function StatusPill({ status }: { status: Campaign['status'] }) {
  const cls =
    status === 'live'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
      : status === 'planned'
        ? 'bg-amber-500/15 text-amber-200 border-amber-500/30'
        : 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30'
  return (
    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  )
}

function KindPill({ kind }: { kind: CampaignKind }) {
  const isBlog = kind === 'dedicated_blog'
  return (
    <span
      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
        isBlog
          ? 'bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/35'
          : 'bg-cyan-500/10 text-cyan-200 border-cyan-500/25'
      }`}
    >
      {kindLabel(kind)}
    </span>
  )
}

function CampaignCard({ c }: { c: Campaign }) {
  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <KindPill kind={c.kind} />
        <StatusPill status={c.status} />
      </div>
      <h3 className="font-semibold text-[var(--text)]">{c.name}</h3>
      <p className="text-sm text-[var(--muted)] leading-relaxed">{c.description}</p>
      <p className="text-xs text-zinc-500">
        Parent app: <span className="text-zinc-400">{c.parentAppName}</span>{' '}
        <code className="text-zinc-500">({c.parentAppId})</code>
      </p>
      {c.url ? (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-[var(--accent)] hover:underline mt-1"
        >
          Open →
        </a>
      ) : (
        <span className="text-xs text-zinc-600 mt-1">URL when live</span>
      )}
      {c.notes ? <p className="text-[11px] text-zinc-600 border-t border-[var(--border)] pt-2 mt-1">{c.notes}</p> : null}
    </article>
  )
}

export default function MarketingHubPage() {
  const byApp = campaignsByParentApp()
  const blogCampaigns = campaigns.filter((c) => c.kind === 'dedicated_blog')
  const liveCount = campaigns.filter((c) => c.status === 'live').length
  const appCount = byApp.size

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <header className="mb-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">216labs</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">Marketing campaigns</h1>
        <p className="mt-3 text-[var(--muted)] text-sm max-w-2xl leading-relaxed">
          Central overview of channels we run per app. A <strong className="text-zinc-300">dedicated blog</strong> is
          one campaign type — usually a separate deploy (e.g. <code className="text-xs text-cyan-400/90">onefitblog</code>{' '}
          for OneFit). Scale by adding rows in{' '}
          <code className="text-xs text-zinc-500">apps/marketing/src/data/campaign-registry.ts</code>.
        </p>
      </header>

      <section className="grid sm:grid-cols-3 gap-4 mb-12">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Apps with campaigns</p>
          <p className="text-3xl font-semibold mt-1 tabular-nums">{appCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Live campaigns</p>
          <p className="text-3xl font-semibold mt-1 tabular-nums text-emerald-400/90">{liveCount}</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide">Dedicated blogs</p>
          <p className="text-3xl font-semibold mt-1 tabular-nums text-fuchsia-400/90">{blogCampaigns.length}</p>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-fuchsia-400">◆</span> Dedicated blogs
        </h2>
        <p className="text-sm text-[var(--muted)] mb-6 max-w-2xl">
          Each product can own an editorial surface. These deploy as their own app in the monorepo; register them here
          and optionally set <code className="text-xs">affiliated_app_id</code> in the blog manifest.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {blogCampaigns.map((c) => (
            <CampaignCard key={c.id} c={c} />
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <span className="text-cyan-400">◇</span> All campaigns by app
        </h2>
        <div className="space-y-8">
          {[...byApp.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([appId, list]) => (
              <div key={appId}>
                <h3 className="text-sm font-medium text-zinc-400 mb-3">
                  {list[0].parentAppName}{' '}
                  <code className="text-xs text-zinc-600 font-normal">({appId})</code>
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {list.map((c) => (
                    <CampaignCard key={c.id} c={c} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </section>

      <footer className="border-t border-[var(--border)] pt-8 text-xs text-zinc-600">
        <p>
          To add a new per-app blog: create <code className="text-zinc-500">apps/&lt;id&gt;blog</code> (or similar),
          point the manifest <code className="text-zinc-500">affiliated_app_id</code> at the parent app, add a{' '}
          <code className="text-zinc-500">dedicated_blog</code> row in the registry, deploy.
        </p>
      </footer>
    </div>
  )
}
