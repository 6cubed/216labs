import { execSync } from "child_process";
import type Database from "better-sqlite3";

export type OrgMetrics = {
  generatedAtUtc: string;
  repo: {
    root: string;
    gitAvailable: boolean;
    headShort?: string;
    commitsTotal?: number;
    commits7d?: number;
    commits30d?: number;
    firstCommitAt?: string;
  };
  surface: {
    manifestTotal?: number;
    manifestProducts?: number;
    manifestInternal?: number;
  };
  quality: {
    errors24h?: number;
    errors7d?: number;
    edgeUniques1d?: number;
    edgeUniques7d?: number;
    edgeUniques30d?: number;
    topErrorApps24h?: Array<{ appId: string; n: number }>;
    topEdgeApps7d?: Array<{ appId: string; uniques: number }>;
  };
  notes: string[];
};

function safeInt(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
  return undefined;
}

function git(cmd: string, repoRoot: string): string | null {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

function isoNowUtc(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function getRepoRoot(): string {
  return (process.env.PROJECTS_ROOT || "/workspace").trim() || "/workspace";
}

export function getOrgMetrics(db: Database.Database): OrgMetrics {
  const repoRoot = getRepoRoot();
  const notes: string[] = [];

  const headShort = git("git rev-parse --short HEAD", repoRoot) ?? undefined;
  const commitsTotal = safeInt(git("git rev-list --count HEAD", repoRoot) ?? undefined);
  const commits7d = safeInt(
    git("git rev-list --count --since='7 days ago' HEAD", repoRoot) ?? undefined
  );
  const commits30d = safeInt(
    git("git rev-list --count --since='30 days ago' HEAD", repoRoot) ?? undefined
  );

  let firstCommitAt: string | undefined;
  const roots = git("git rev-list --max-parents=0 HEAD", repoRoot);
  if (roots) {
    const hashes = roots.split("\n").map((s) => s.trim()).filter(Boolean);
    const dates = hashes
      .map((h) => git(`git show -s --format=%cI ${h}`, repoRoot))
      .filter((d): d is string => Boolean(d));
    dates.sort();
    if (dates[0]) firstCommitAt = dates[0];
  }

  const gitAvailable = Boolean(headShort || commitsTotal != null);
  if (!gitAvailable) {
    notes.push(
      `git unavailable in ${repoRoot} (missing .git mount or git binary); repo velocity/surface metrics will be partial`
    );
  }

  // Surface area: count manifests from git index (fast, ignores vendor/noise).
  let manifestTotal: number | undefined;
  let manifestProducts: number | undefined;
  let manifestInternal: number | undefined;
  const ls = git("git ls-files -- '**/manifest.json'", repoRoot);
  if (ls) {
    const files = ls.split("\n").map((s) => s.trim()).filter(Boolean);
    manifestTotal = files.length;
    manifestProducts = files.filter((f) => f.startsWith("products/")).length;
    manifestInternal = files.filter((f) => f.startsWith("internal/")).length;
  } else {
    notes.push("manifest counts unavailable (git ls-files failed)");
  }

  // Quality: reported errors + edge uniques (if tables exist).
  const tableExists = (name: string) => {
    try {
      const row = db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1;"
        )
        .get(name) as { name?: string } | undefined;
      return Boolean(row?.name);
    } catch {
      return false;
    }
  };

  const quality: OrgMetrics["quality"] = {};

  if (tableExists("client_error_event")) {
    quality.errors24h = (db
      .prepare(
        "SELECT COUNT(*) AS n FROM client_error_event WHERE datetime(occurred_at) >= datetime('now', '-24 hours');"
      )
      .get() as { n: number }).n;
    quality.errors7d = (db
      .prepare(
        "SELECT COUNT(*) AS n FROM client_error_event WHERE datetime(occurred_at) >= datetime('now', '-168 hours');"
      )
      .get() as { n: number }).n;
    quality.topErrorApps24h = db
      .prepare(
        `
        SELECT app_id AS appId, COUNT(*) AS n
        FROM client_error_event
        WHERE datetime(occurred_at) >= datetime('now', '-24 hours')
        GROUP BY app_id
        ORDER BY n DESC, app_id ASC
        LIMIT 10;
        `
      )
      .all() as Array<{ appId: string; n: number }>;
  } else {
    notes.push("client_error_event missing; error rate metrics unavailable");
  }

  if (tableExists("edge_visitor_day")) {
    const uniquesSinceDays = (days: number) =>
      (db
        .prepare(
          "SELECT COUNT(DISTINCT visitor_hash) AS uniques FROM edge_visitor_day WHERE day_utc >= date('now', ?);"
        )
        .get(`-${days} days`) as { uniques: number }).uniques;
    quality.edgeUniques1d = uniquesSinceDays(1);
    quality.edgeUniques7d = uniquesSinceDays(7);
    quality.edgeUniques30d = uniquesSinceDays(30);
    quality.topEdgeApps7d = db
      .prepare(
        `
        SELECT app_id AS appId, COUNT(DISTINCT visitor_hash) AS uniques
        FROM edge_visitor_day
        WHERE day_utc >= date('now', '-7 days')
        GROUP BY app_id
        ORDER BY uniques DESC, app_id ASC
        LIMIT 10;
        `
      )
      .all() as Array<{ appId: string; uniques: number }>;
  } else {
    notes.push("edge_visitor_day missing; edge uniques metrics unavailable");
  }

  return {
    generatedAtUtc: isoNowUtc(),
    repo: {
      root: repoRoot,
      gitAvailable,
      headShort,
      commitsTotal,
      commits7d,
      commits30d,
      firstCommitAt,
    },
    surface: { manifestTotal, manifestProducts, manifestInternal },
    quality,
    notes,
  };
}

