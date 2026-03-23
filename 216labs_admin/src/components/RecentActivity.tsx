import {
  formatAbsoluteTime,
  formatRelativeTime,
  type RecentActivityItem,
} from "@/lib/recent-activity";

export function RecentActivity({
  items,
  title = "Recent Activity",
  subtitle = "Latest deployments across your app portfolio",
  emptyState = "No deployment activity yet. Run a deploy to populate this feed.",
}: {
  items: RecentActivityItem[];
  title?: string;
  subtitle?: string;
  emptyState?: string;
}) {

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        {title}
      </h2>
      <p className="text-sm text-muted mb-4">{subtitle}</p>

      {items.length === 0 ? (
        <div className="text-sm text-muted py-3">{emptyState}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.appId}-${item.deployedAtRaw}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 py-2.5 border-b border-white/5 last:border-0"
            >
              <p className="text-sm text-foreground">
                <span className="font-mono text-accent">{item.host}</span>{" "}
                deployed{" "}
                <span className="text-foreground/90">
                  {formatRelativeTime(item.deployedAtMs)}
                </span>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="text-muted"
                  title={item.appName}
                >
                  {formatAbsoluteTime(item.deployedAtMs, item.deployedAtRaw)}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline"
                >
                  open
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
