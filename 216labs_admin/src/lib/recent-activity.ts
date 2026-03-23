export type RecentActivitySource = {
  id: string;
  name: string;
  lastDeployedAt: string | null;
};

export type RecentActivityItem = {
  appId: string;
  appName: string;
  deployedAtRaw: string;
  deployedAtMs: number;
  host: string;
  url: string;
};

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app";

function resolveHost(appId: string): string {
  const host = APP_HOST.trim();
  if (!host || host === "localhost") return `${appId}.6cubed.app`;
  return `${appId}.${host}`;
}

function parseDeploymentTimestamp(value: string): number {
  const raw = value.trim();
  if (!raw) return Number.NaN;

  // SQLite often stores timestamps as "YYYY-MM-DD HH:MM:SS".
  const sqliteLike = raw.includes(" ") && !raw.includes("T");
  const normalized = sqliteLike ? raw.replace(" ", "T") + "Z" : raw;
  return Date.parse(normalized);
}

export function buildRecentActivityFeed(
  rows: RecentActivitySource[],
): RecentActivityItem[] {
  return rows
    .map((row) => {
      const deployedAtRaw = row.lastDeployedAt ?? "";
      const deployedAtMs = parseDeploymentTimestamp(deployedAtRaw);
      if (!Number.isFinite(deployedAtMs)) return null;
      const host = resolveHost(row.id);
      return {
        appId: row.id,
        appName: row.name,
        deployedAtRaw,
        deployedAtMs,
        host,
        url: `https://${host}`,
      };
    })
    .filter((item): item is RecentActivityItem => item !== null)
    .sort((a, b) => b.deployedAtMs - a.deployedAtMs);
}

export function formatRelativeTime(timestampMs: number): string {
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

export function formatAbsoluteTime(timestampMs: number, fallback: string): string {
  if (!Number.isFinite(timestampMs)) return fallback;
  return new Date(timestampMs).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
