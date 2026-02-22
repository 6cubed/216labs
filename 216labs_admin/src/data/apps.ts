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
  deploymentStatus: DeploymentStatus;
  memoryLimit: string;
  marketingSpend?: {
    monthly: number;
    channel: string;
    notes?: string;
  };
  externalUrl?: string;
  repoPath: string;
}

export const apps: AppInfo[] = [
  {
    id: "ramblingradio",
    name: "RamblingRadio",
    tagline: "Community radio & podcasting",
    description:
      "Express + React + Vite full-stack application with PostgreSQL backend via Drizzle ORM. Community-driven audio content platform.",
    category: "consumer",
    stack: {
      frontend: "React 18 + Vite",
      backend: "Express 5",
      database: "PostgreSQL (Drizzle ORM)",
    },
    port: 8001,
    dockerService: "ramblingradio",
    dockerImage: "216labs/ramblingradio:latest",
    directory: "RamblingRadio",
    createdAt: "2026-01-27",
    lastUpdated: "2026-02-22",
    totalCommits: 4,
    deploymentStatus: "running",
    memoryLimit: "256 MB",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
      notes: "Pre-launch phase",
    },
    repoPath: "RamblingRadio",
  },
  {
    id: "stroll",
    name: "Stroll.live",
    tagline: "Live walking & exploration",
    description:
      "Express + React + Vite application with SQLite via Drizzle ORM. Real-time walking and exploration experience platform.",
    category: "consumer",
    stack: {
      frontend: "React 18 + Vite",
      backend: "Express 5",
      database: "SQLite (Drizzle ORM)",
    },
    port: 8002,
    dockerService: "stroll",
    dockerImage: "216labs/stroll:latest",
    directory: "Stroll.live",
    createdAt: "2026-02-21",
    lastUpdated: "2026-02-22",
    totalCommits: 4,
    deploymentStatus: "running",
    memoryLimit: "256 MB",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
      notes: "Pre-launch phase",
    },
    repoPath: "Stroll.live",
  },
  {
    id: "onefit",
    name: "OneFit",
    tagline: "AI personal stylist",
    description:
      "Upload photos and get AI-generated outfit recommendations. Powered by OpenAI GPT-4o Vision for analysis and DALL-E 3 for visualization.",
    category: "ai",
    stack: {
      frontend: "Next.js 14",
      database: "SQLite (better-sqlite3)",
      other: ["OpenAI GPT-4o Vision", "DALL-E 3", "Framer Motion"],
    },
    port: 8003,
    dockerService: "onefit",
    dockerImage: "216labs/onefit:latest",
    directory: "onefit",
    createdAt: "2026-02-22",
    lastUpdated: "2026-02-22",
    totalCommits: 3,
    deploymentStatus: "running",
    memoryLimit: "256 MB",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
    },
    repoPath: "onefit",
  },
  {
    id: "paperframe",
    name: "Paperframe",
    tagline: "AI image segmentation & captioning",
    description:
      "Segment and caption images using SAM (Segment Anything Model) and BLIP. Includes optional ML backend requiring ~2GB RAM, enabled via Docker profile.",
    category: "ai",
    stack: {
      frontend: "Next.js 15 + React 19",
      backend: "FastAPI (optional ML profile)",
      other: ["SAM (Segment Anything)", "BLIP (Salesforce)"],
    },
    port: 8004,
    dockerService: "paperframe-frontend",
    dockerImage: "216labs/paperframe-frontend:latest",
    directory: "paperframe",
    createdAt: "2026-02-22",
    lastUpdated: "2026-02-22",
    totalCommits: 3,
    deploymentStatus: "running",
    memoryLimit: "256 MB (frontend) / 2 GB (ML backend)",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
    },
    repoPath: "paperframe",
  },
  {
    id: "hivefind",
    name: "HiveFind",
    tagline: "Crowd-sourced mystery investigation",
    description:
      "A crowd-sourced platform for gathering clues, tips, and timelines about unsolved mysteries. Join the hive and help solve the case.",
    category: "consumer",
    stack: {
      frontend: "Next.js 16 + React 19",
      other: ["Tailwind CSS 4"],
    },
    port: 8005,
    dockerService: "hivefind",
    dockerImage: "216labs/hivefind:latest",
    directory: "hivefind",
    createdAt: "2026-02-22",
    lastUpdated: "2026-02-22",
    totalCommits: 2,
    deploymentStatus: "running",
    memoryLimit: "256 MB",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
    },
    repoPath: "hivefind",
  },
  {
    id: "pipesecure",
    name: "PipeSecure",
    tagline: "AI-powered security scanning for GitHub",
    description:
      "Continuous security scanning for GitHub repositories. Uses AI analysis with Semgrep and ast-grep for vulnerability detection. Features GitHub App integration, background job processing via BullMQ + Redis.",
    category: "security",
    stack: {
      frontend: "Next.js 16",
      backend: "NextAuth.js v5 + BullMQ worker",
      database: "PostgreSQL (Prisma)",
      other: ["Redis", "OpenAI SDK", "Semgrep", "ast-grep"],
    },
    port: 8006,
    dockerService: "pipesecure",
    dockerImage: "216labs/pipesecure:latest",
    directory: "pipesecure",
    createdAt: "2026-02-22",
    lastUpdated: "2026-02-22",
    totalCommits: 1,
    deploymentStatus: "running",
    memoryLimit: "256 MB (app) / 512 MB (worker)",
    marketingSpend: {
      monthly: 0,
      channel: "Organic",
      notes: "Developer tool — targeting GitHub marketplace",
    },
    repoPath: "pipesecure",
  },
];

export const infrastructure = {
  provider: "DigitalOcean",
  dropletIp: "46.101.88.197",
  monthlyCost: "$6-12",
  reverseProxy: "Caddy 2 (auto HTTPS)",
  databases: ["PostgreSQL 16", "Redis 7", "SQLite (embedded)"],
  totalApps: apps.length,
  totalMemoryAllocated: "1.6 GB (apps) + 192 MB (infra)",
  portRange: "8001-8007",
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
