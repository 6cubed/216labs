import Database from "better-sqlite3";
import { join } from "path";

export interface DbApp {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  port: number;
  docker_service: string;
  docker_image: string;
  directory: string;
  repo_path: string;
  stack_frontend: string | null;
  stack_backend: string | null;
  stack_database: string | null;
  stack_other: string | null;
  deploy_enabled: number;
  image_size_mb: number | null;
  memory_limit: string | null;
  startup_time_ms: number | null;
  created_at: string | null;
  last_updated: string | null;
  last_deployed_at: string | null;
  total_commits: number;
  marketing_monthly: number;
  marketing_channel: string;
  marketing_notes: string | null;
}

const DB_PATH =
  process.env.DATABASE_PATH || join(process.cwd(), "..", "216labs.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS apps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'consumer',
      port INTEGER NOT NULL,
      docker_service TEXT NOT NULL,
      docker_image TEXT NOT NULL,
      directory TEXT NOT NULL,
      repo_path TEXT NOT NULL,
      stack_frontend TEXT,
      stack_backend TEXT,
      stack_database TEXT,
      stack_other TEXT,
      deploy_enabled INTEGER NOT NULL DEFAULT 1,
      image_size_mb REAL,
      memory_limit TEXT,
      startup_time_ms INTEGER,
      created_at TEXT,
      last_updated TEXT,
      last_deployed_at TEXT,
      total_commits INTEGER DEFAULT 0,
      marketing_monthly REAL DEFAULT 0,
      marketing_channel TEXT DEFAULT 'Organic',
      marketing_notes TEXT
    );
  `);

  const count = (
    db.prepare("SELECT COUNT(*) as count FROM apps").get() as {
      count: number;
    }
  ).count;
  if (count === 0) {
    seed(db);
  } else {
    backfillAgitShirts(db);
    backfillPriors(db);
  }
}

function seed(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO apps (
      id, name, tagline, description, category, port,
      docker_service, docker_image, directory, repo_path,
      stack_frontend, stack_backend, stack_database, stack_other,
      deploy_enabled, image_size_mb, memory_limit,
      created_at, last_updated, total_commits,
      marketing_monthly, marketing_channel, marketing_notes
    ) VALUES (
      @id, @name, @tagline, @description, @category, @port,
      @docker_service, @docker_image, @directory, @repo_path,
      @stack_frontend, @stack_backend, @stack_database, @stack_other,
      @deploy_enabled, @image_size_mb, @memory_limit,
      @created_at, @last_updated, @total_commits,
      @marketing_monthly, @marketing_channel, @marketing_notes
    )
  `);

  const apps = [
    {
      id: "ramblingradio",
      name: "RamblingRadio",
      tagline: "Community radio & podcasting",
      description:
        "Express + React + Vite full-stack application with PostgreSQL backend via Drizzle ORM. Community-driven audio content platform.",
      category: "consumer",
      port: 8001,
      docker_service: "ramblingradio",
      docker_image: "216labs/ramblingradio:latest",
      directory: "RamblingRadio",
      repo_path: "RamblingRadio",
      stack_frontend: "React 18 + Vite",
      stack_backend: "Express 5",
      stack_database: "PostgreSQL (Drizzle ORM)",
      stack_other: null,
      deploy_enabled: 1,
      image_size_mb: 1020,
      memory_limit: "256 MB",
      created_at: "2026-01-27",
      last_updated: "2026-02-22",
      total_commits: 4,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: "Pre-launch phase",
    },
    {
      id: "stroll",
      name: "Stroll.live",
      tagline: "Live walking & exploration",
      description:
        "Express + React + Vite application with SQLite via Drizzle ORM. Real-time walking and exploration experience platform.",
      category: "consumer",
      port: 8002,
      docker_service: "stroll",
      docker_image: "216labs/stroll:latest",
      directory: "Stroll.live",
      repo_path: "Stroll.live",
      stack_frontend: "React 18 + Vite",
      stack_backend: "Express 5",
      stack_database: "SQLite (Drizzle ORM)",
      stack_other: null,
      deploy_enabled: 1,
      image_size_mb: 422,
      memory_limit: "256 MB",
      created_at: "2026-02-21",
      last_updated: "2026-02-22",
      total_commits: 4,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: "Pre-launch phase",
    },
    {
      id: "onefit",
      name: "OneFit",
      tagline: "AI personal stylist",
      description:
        "Upload photos and get AI-generated outfit recommendations. Powered by OpenAI GPT-4o Vision for analysis and DALL-E 3 for visualization.",
      category: "ai",
      port: 8003,
      docker_service: "onefit",
      docker_image: "216labs/onefit:latest",
      directory: "onefit",
      repo_path: "onefit",
      stack_frontend: "Next.js 14",
      stack_backend: null,
      stack_database: "SQLite (better-sqlite3)",
      stack_other: '["OpenAI GPT-4o Vision","DALL-E 3","Framer Motion"]',
      deploy_enabled: 1,
      image_size_mb: 334,
      memory_limit: "256 MB",
      created_at: "2026-02-22",
      last_updated: "2026-02-22",
      total_commits: 3,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: null,
    },
    {
      id: "paperframe",
      name: "Paperframe",
      tagline: "AI image segmentation & captioning",
      description:
        "Segment and caption images using SAM (Segment Anything Model) and BLIP. Includes optional ML backend requiring ~2GB RAM, enabled via Docker profile.",
      category: "ai",
      port: 8004,
      docker_service: "paperframe-frontend",
      docker_image: "216labs/paperframe-frontend:latest",
      directory: "paperframe",
      repo_path: "paperframe",
      stack_frontend: "Next.js 15 + React 19",
      stack_backend: "FastAPI (optional ML profile)",
      stack_database: null,
      stack_other: '["SAM (Segment Anything)","BLIP (Salesforce)"]',
      deploy_enabled: 1,
      image_size_mb: 440,
      memory_limit: "256 MB (frontend) / 2 GB (ML backend)",
      created_at: "2026-02-22",
      last_updated: "2026-02-22",
      total_commits: 3,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: null,
    },
    {
      id: "hivefind",
      name: "HiveFind",
      tagline: "Crowd-sourced mystery investigation",
      description:
        "A crowd-sourced platform for gathering clues, tips, and timelines about unsolved mysteries. Join the hive and help solve the case.",
      category: "consumer",
      port: 8005,
      docker_service: "hivefind",
      docker_image: "216labs/hivefind:latest",
      directory: "hivefind",
      repo_path: "hivefind",
      stack_frontend: "Next.js 16 + React 19",
      stack_backend: null,
      stack_database: null,
      stack_other: '["Tailwind CSS 4"]',
      deploy_enabled: 1,
      image_size_mb: 435,
      memory_limit: "256 MB",
      created_at: "2026-02-22",
      last_updated: "2026-02-22",
      total_commits: 2,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: null,
    },
    {
      id: "pipesecure",
      name: "PipeSecure",
      tagline: "AI-powered security scanning for GitHub",
      description:
        "Continuous security scanning for GitHub repositories. Uses AI analysis with Semgrep and ast-grep for vulnerability detection. Features GitHub App integration, background job processing via BullMQ + Redis.",
      category: "security",
      port: 8006,
      docker_service: "pipesecure",
      docker_image: "216labs/pipesecure:latest",
      directory: "pipesecure",
      repo_path: "pipesecure",
      stack_frontend: "Next.js 16",
      stack_backend: "NextAuth.js v5 + BullMQ worker",
      stack_database: "PostgreSQL (Prisma)",
      stack_other: '["Redis","OpenAI SDK","Semgrep","ast-grep"]',
      deploy_enabled: 0,
      image_size_mb: 480,
      memory_limit: "256 MB (app) / 512 MB (worker)",
      created_at: "2026-02-22",
      last_updated: "2026-02-22",
      total_commits: 1,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: "Developer tool — targeting GitHub marketplace",
    },
    {
      id: "agitshirts",
      name: "AgitShirts",
      tagline: "Daily AI-designed limited-edition t-shirt drops",
      description:
        "Flask app that auto-generates one collectible t-shirt concept per day using AI prompts, with a direct checkout link for limited daily editions.",
      category: "ai",
      port: 8009,
      docker_service: "agitshirts",
      docker_image: "216labs/agitshirts:latest",
      directory: "agitshirts",
      repo_path: "agitshirts",
      stack_frontend: "Flask templates",
      stack_backend: "Flask + Python",
      stack_database: "JSON file store",
      stack_other: '["OpenAI API (optional)","Gunicorn"]',
      deploy_enabled: 1,
      image_size_mb: 120,
      memory_limit: "128 MB",
      created_at: "2026-02-23",
      last_updated: "2026-02-23",
      total_commits: 1,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: "Limited daily drops with direct buy CTA",
    },
    {
      id: "priors",
      name: "Priors",
      tagline: "Question probabilities with AI",
      description:
        "Flask app for tracking personal yes/no priors with Google sign-in and Gemini-assisted likelihood estimates.",
      category: "ai",
      port: 8010,
      docker_service: "priors",
      docker_image: "216labs/priors:latest",
      directory: "priors",
      repo_path: "priors",
      stack_frontend: "Flask templates",
      stack_backend: "Flask + Gunicorn",
      stack_database: "SQLite",
      stack_other: '["Google OAuth","Gemini API"]',
      deploy_enabled: 1,
      image_size_mb: 128,
      memory_limit: "128 MB",
      created_at: "2026-02-23",
      last_updated: "2026-02-23",
      total_commits: 1,
      marketing_monthly: 0,
      marketing_channel: "Organic",
      marketing_notes: "Pre-launch phase",
    },
  ];

  const insertMany = db.transaction((rows: typeof apps) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(apps);
}

function backfillAgitShirts(db: Database.Database) {
  const exists = (
    db.prepare("SELECT COUNT(*) as count FROM apps WHERE id = 'agitshirts'").get() as {
      count: number;
    }
  ).count;

  if (exists > 0) {
    return;
  }

  db.prepare(`
    INSERT INTO apps (
      id, name, tagline, description, category, port,
      docker_service, docker_image, directory, repo_path,
      stack_frontend, stack_backend, stack_database, stack_other,
      deploy_enabled, image_size_mb, memory_limit,
      created_at, last_updated, total_commits,
      marketing_monthly, marketing_channel, marketing_notes
    ) VALUES (
      @id, @name, @tagline, @description, @category, @port,
      @docker_service, @docker_image, @directory, @repo_path,
      @stack_frontend, @stack_backend, @stack_database, @stack_other,
      @deploy_enabled, @image_size_mb, @memory_limit,
      @created_at, @last_updated, @total_commits,
      @marketing_monthly, @marketing_channel, @marketing_notes
    )
  `).run({
    id: "agitshirts",
    name: "AgitShirts",
    tagline: "Daily AI-designed limited-edition t-shirt drops",
    description:
      "Flask app that auto-generates one collectible t-shirt concept per day using AI prompts, with a direct checkout link for limited daily editions.",
    category: "ai",
    port: 8009,
    docker_service: "agitshirts",
    docker_image: "216labs/agitshirts:latest",
    directory: "agitshirts",
    repo_path: "agitshirts",
    stack_frontend: "Flask templates",
    stack_backend: "Flask + Python",
    stack_database: "JSON file store",
    stack_other: '["OpenAI API (optional)","Gunicorn"]',
    deploy_enabled: 1,
    image_size_mb: 120,
    memory_limit: "128 MB",
    created_at: "2026-02-23",
    last_updated: "2026-02-23",
    total_commits: 1,
    marketing_monthly: 0,
    marketing_channel: "Organic",
    marketing_notes: "Limited daily drops with direct buy CTA",
  });
}

function backfillPriors(db: Database.Database) {
  const exists = (
    db.prepare("SELECT COUNT(*) as count FROM apps WHERE id = 'priors'").get() as {
      count: number;
    }
  ).count;

  if (exists > 0) {
    return;
  }

  db.prepare(`
    INSERT INTO apps (
      id, name, tagline, description, category, port,
      docker_service, docker_image, directory, repo_path,
      stack_frontend, stack_backend, stack_database, stack_other,
      deploy_enabled, image_size_mb, memory_limit,
      created_at, last_updated, total_commits,
      marketing_monthly, marketing_channel, marketing_notes
    ) VALUES (
      @id, @name, @tagline, @description, @category, @port,
      @docker_service, @docker_image, @directory, @repo_path,
      @stack_frontend, @stack_backend, @stack_database, @stack_other,
      @deploy_enabled, @image_size_mb, @memory_limit,
      @created_at, @last_updated, @total_commits,
      @marketing_monthly, @marketing_channel, @marketing_notes
    )
  `).run({
    id: "priors",
    name: "Priors",
    tagline: "Question probabilities with AI",
    description:
      "Flask app for tracking personal yes/no priors with Google sign-in and Gemini-assisted likelihood estimates.",
    category: "ai",
    port: 8010,
    docker_service: "priors",
    docker_image: "216labs/priors:latest",
    directory: "priors",
    repo_path: "priors",
    stack_frontend: "Flask templates",
    stack_backend: "Flask + Gunicorn",
    stack_database: "SQLite",
    stack_other: '["Google OAuth","Gemini API"]',
    deploy_enabled: 1,
    image_size_mb: 128,
    memory_limit: "128 MB",
    created_at: "2026-02-23",
    last_updated: "2026-02-23",
    total_commits: 1,
    marketing_monthly: 0,
    marketing_channel: "Organic",
    marketing_notes: "Pre-launch phase",
  });
}

export function getAllApps(): DbApp[] {
  return getDb().prepare("SELECT * FROM apps ORDER BY port").all() as DbApp[];
}

export function getEnabledApps(): DbApp[] {
  return getDb()
    .prepare("SELECT * FROM apps WHERE deploy_enabled = 1 ORDER BY port")
    .all() as DbApp[];
}

export function setDeployEnabled(appId: string, enabled: boolean): void {
  getDb()
    .prepare("UPDATE apps SET deploy_enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, appId);
}

export function updateAppMetadata(
  appId: string,
  data: Partial<
    Pick<DbApp, "image_size_mb" | "startup_time_ms" | "last_deployed_at">
  >
): void {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      sets.push(`${key} = ?`);
      values.push(val);
    }
  }
  if (sets.length === 0) return;

  values.push(appId);
  getDb()
    .prepare(`UPDATE apps SET ${sets.join(", ")} WHERE id = ?`)
    .run(...values);
}
