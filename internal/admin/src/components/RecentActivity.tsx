import {
  formatAbsoluteTime,
  formatRelativeTime,
} from "@/lib/recent-activity";
import type { UnifiedDeploymentFeedItem } from "@/lib/deployment-feed";

function channelLabel(channel: UnifiedDeploymentFeedItem["channel"]): string {
  switch (channel) {
    case "vps":
      return "VPS";
    case "app":
      return "App";
    case "ci":
      return "CI";
    default:
      return "Apps";
  }
}

export function RecentActivity({
  items,
  title = "Recent Activity",
  subtitle = "VPS deploys, app rollouts, and GHCR CI — newest first",
  emptyState = "No deployment activity yet. Push to main (CI) or run deploy.sh (VPS) to populate this feed.",
}: {
  items: UnifiedDeploymentFeedItem[];
  title?: string;
  subtitle?: string;
  emptyState?: string;
}) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">{title}</h2>
      <p className="text-sm text-muted mb-4">{subtitle}</p>

      {items.length === 0 ? (
        <div className="text-sm text-muted py-3">{emptyState}</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1.5 py-2.5 border-b border-white/5 last:border-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">
                  <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-muted mr-2">
                    {channelLabel(item.channel)}
                  </span>
                  <span className="font-medium">{item.headline}</span>
                  {item.detail ? (
                    <span className="text-muted"> — {item.detail}</span>
                  ) : null}
                </p>
                {item.appId ? (
                  <p className="text-xs text-muted mt-0.5 font-mono">
                    app: {item.appId}
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0">
                <span
                  className="text-muted"
                  title={formatAbsoluteTime(item.occurredAtMs, "")}
                >
                  {formatRelativeTime(item.occurredAtMs)}
                </span>
                {item.href ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    open
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
