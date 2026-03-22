import type { AppInfo } from "@/data/apps";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "";

type RecentActivityItem = {
  appId: string;
  deployedAt: string;
  host: string;
  url: string | null;
  sortTimeMs: number;
};

function resolveHost(appId: string): string {
  if (APP_HOST && APP_HOST !== "localhost") return `${appId}.${APP_HOST}`;
  return `${appId}.6cubed.app`;
}

function parseTimestamp(dateStr: string): number {
  if (!dateStr) return Number.NaN;
  const normalized = dateStr.includes("T")
    ? dateStr
    : dateStr.replace(" ", "T") + "Z";
  return Date.parse(normalized);
}

function formatRelativeTime(timestampMs: number): string {
  if (!Number.isFinite(timestampMs)) return "just now";
  const diffMs = Date.now() - timestampMs;
  if (diffMs <= 0) return "just now";
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function formatAbsoluteDate(timestampMs: number, fallback: string): string {
  if (!Number.isFinite(timestampMs)) return fallback;
  return new Date(timestampMs).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildRecentActivity(apps: AppInfo[]): RecentActivityItem[] {
  return apps
    .filter((app) => Boolean(app.lastDeployedAt))
    .map((app) => {
      const deployedAt = app.lastDeployedAt || "";
      const sortTimeMs = parseTimestamp(deployedAt);
      const host = resolveHost(app.id);
      return {
        appId: app.id,
        deployedAt,
        host,
        url: `https://${host}`,
        sortTimeMs,
      };
    })
    .filter((item) => Number.isFinite(item.sortTimeMs))
    .sort((a, b) => (b.sortTimeMs || 0) - (a.sortTimeMs || 0))
    .slice(0, 8);
}

export function RecentActivity({ apps }: { apps: AppInfo[] }) {
  const items = buildRecentActivity(apps);

  return (
    <div className="bg-surface border border-border rounded-2xl p-6">
      <h2 className="text-lg font-semibold text-foreground mb-1">
        Recent Activity
      </h2>
      <p className="text-sm text-muted mb-4">
        Latest deployments across your app portfolio
      </p>

      {items.length === 0 ? (
        <div className="text-sm text-muted py-3">
          No deployment activity yet. Run a deploy to populate this feed.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={`${item.appId}-${item.deployedAt}`}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1.5 py-2.5 border-b border-white/5 last:border-0"
            >
              <p className="text-sm text-foreground">
                <span className="font-mono text-accent">{item.host}</span>{" "}
                deployed{" "}
                <span className="text-foreground/90">
                  {formatRelativeTime(item.sortTimeMs)}
                </span>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className="text-muted"
                  title={formatAbsoluteDate(item.sortTimeMs, item.deployedAt)}
                >
                  {formatAbsoluteDate(item.sortTimeMs, item.deployedAt)}
                </span>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline"
                  >
                    open
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
