import type { AppInfo } from "@/data/apps";

function formatSize(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${mb} MB`;
}

export function SizeOverview({
  apps,
  enabledApps,
}: {
  apps: AppInfo[];
  enabledApps: Set<string>;
}) {
  const maxSize = Math.max(...apps.map((a) => a.imageSizeMB));
  const enabledTotal = apps
    .filter((a) => enabledApps.has(a.id))
    .reduce((sum, a) => sum + a.imageSizeMB, 0);
  const totalAll = apps.reduce((sum, a) => sum + a.imageSizeMB, 0);

  const infraSizeMB = 83 + 61 + 392; // caddy + redis + postgres

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-semibold text-foreground">
          Deploy Size
        </h2>
        <div className="text-right">
          <p className="text-sm font-mono text-foreground">
            {formatSize(enabledTotal + infraSizeMB)}
          </p>
          <p className="text-[11px] text-muted">
            transfer size (apps + infra)
          </p>
        </div>
      </div>

      <div className="space-y-2.5">
        {apps.map((app) => {
          const enabled = enabledApps.has(app.id);
          const pct = (app.imageSizeMB / maxSize) * 100;
          return (
            <div key={app.id} className={enabled ? "" : "opacity-40"}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground font-medium truncate">
                  {app.name}
                </span>
                <span className="text-[11px] font-mono text-muted ml-2 shrink-0">
                  {formatSize(app.imageSizeMB)}
                </span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    enabled
                      ? app.imageSizeMB >= 800
                        ? "bg-red-400/70"
                        : app.imageSizeMB >= 500
                          ? "bg-amber-400/70"
                          : "bg-emerald-400/70"
                      : "bg-white/10"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-sm font-mono text-foreground">
            {formatSize(enabledTotal)}
          </p>
          <p className="text-[11px] text-muted">enabled apps</p>
        </div>
        <div>
          <p className="text-sm font-mono text-foreground">
            {formatSize(infraSizeMB)}
          </p>
          <p className="text-[11px] text-muted">infrastructure</p>
        </div>
        <div>
          <p className="text-sm font-mono text-muted">
            {formatSize(totalAll - enabledTotal)}
          </p>
          <p className="text-[11px] text-muted">disabled</p>
        </div>
      </div>
    </div>
  );
}
