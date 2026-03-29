import type { AdminErrorItem } from "@/lib/admin-errors";

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sourceLabel(source: AdminErrorItem["source"]): string {
  switch (source) {
    case "runtime":
      return "Activator";
    case "deployment":
      return "Deploy log";
    case "ci":
      return "GitHub Actions";
    default:
      return source;
  }
}

export function ErrorMonitorSection({ items }: { items: AdminErrorItem[] }) {
  return (
    <section className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Errors &amp; alerts</h2>
          <p className="text-xs text-muted mt-1 max-w-2xl">
            Runtime failures from the activator (per app), deployment log lines that look like errors,
            and failed or cancelled GHCR CI runs. Use{" "}
            <span className="font-mono text-foreground/90">ADMIN_GITHUB_TOKEN</span> in Env for
            higher GitHub API rate limits.
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
          <p className="text-sm text-muted">
            No activator errors, no suspicious deployment log lines, and no recent failed CI runs.
          </p>
          <p className="text-xs text-muted/80 mt-2">
            If an app misbehaves, check{" "}
            <a href="/applications" className="text-accent hover:underline">
              Applications
            </a>{" "}
            for container logs.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
                <th className="px-4 py-3 font-medium">When</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Severity</th>
                <th className="px-4 py-3 font-medium">Summary</th>
                <th className="px-4 py-3 font-medium">Detail</th>
                <th className="px-4 py-3 font-medium">Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border/80 hover:bg-white/[0.02] align-top"
                >
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap font-mono">
                    {formatWhen(row.occurredAtMs)}
                  </td>
                  <td className="px-4 py-3 text-xs text-foreground">
                    {sourceLabel(row.source)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                        row.severity === "error"
                          ? "border-red-500/35 bg-red-500/10 text-red-300"
                          : "border-amber-500/35 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground max-w-[220px]">
                    <span className="font-medium line-clamp-2">{row.headline}</span>
                    {row.appId && (
                      <span className="block text-[11px] font-mono text-muted mt-0.5">
                        {row.appId}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted max-w-md">
                    <p className="line-clamp-4 whitespace-pre-wrap break-words">{row.detail}</p>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.href ? (
                      <a
                        href={row.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline font-medium"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
