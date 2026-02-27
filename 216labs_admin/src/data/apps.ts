import type { DbApp } from "@/lib/db";

export type DeploymentStatus = "running" | "stopped" | "deploying" | "error";
export type AppCategory = "consumer" | "tool" | "ai" | "security" | "admin";

export interface AppInfo {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: AppCategory;
  stack: {
    frontend: string;
    backend?: string;
    database?: string;
    other?: string[];
  };
  port: number;
  dockerService: string;
  dockerImage: string;
  directory: string;
  createdAt: string;
  lastUpdated: string;
  totalCommits: number;
  memoryLimit: string;
  imageSizeMB: number;
  deployEnabled: boolean;
  startupTimeMs: number | null;
  lastDeployedAt: string | null;
  marketingSpend?: {
    monthly: number;
    channel: string;
    notes?: string;
  };
  repoPath: string;
}

export function dbRowToAppInfo(row: DbApp): AppInfo {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    category: row.category as AppCategory,
    stack: {
      frontend: row.stack_frontend ?? "",
      backend: row.stack_backend ?? undefined,
      database: row.stack_database ?? undefined,
      other: row.stack_other ? JSON.parse(row.stack_other) : undefined,
    },
    port: row.port,
    dockerService: row.docker_service,
    dockerImage: row.docker_image,
    directory: row.directory,
    createdAt: row.created_at ?? "",
    lastUpdated: row.last_updated ?? "",
    totalCommits: row.total_commits,
    memoryLimit: row.memory_limit ?? "256 MB",
    imageSizeMB: row.image_size_mb ?? 0,
    deployEnabled: row.deploy_enabled === 1,
    startupTimeMs: row.startup_time_ms,
    lastDeployedAt: row.last_deployed_at,
    marketingSpend:
      row.marketing_monthly !== undefined
        ? {
            monthly: row.marketing_monthly,
            channel: row.marketing_channel,
            notes: row.marketing_notes ?? undefined,
          }
        : undefined,
    repoPath: row.repo_path,
  };
}

export const infrastructure = {
  provider: "DigitalOcean",
  dropletIp: "46.101.88.197",
  adminUrl: "https://admin.agimemes.com",
  monthlyCost: "$6-12",
  reverseProxy: "Caddy 2 (auto HTTPS)",
  databases: ["PostgreSQL 16", "Redis 7", "SQLite (embedded)"],
  totalApps: 20,
  totalMemoryAllocated: "~2.1 GB (without ML profile)",
  domain: "*.agimemes.com",
  deployMethod: "Docker images built locally, transferred via SSH",
};

export const categoryLabels: Record<AppCategory, string> = {
  consumer: "Consumer",
  tool: "Tool",
  ai: "AI / ML",
  security: "Security",
  admin: "Admin",
};

export const categoryColors: Record<AppCategory, string> = {
  consumer: "bg-blue-500/15 text-blue-400 border-blue-500/25",
  tool: "bg-purple-500/15 text-purple-400 border-purple-500/25",
  ai: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
  security: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  admin: "bg-slate-500/15 text-slate-400 border-slate-500/25",
};
