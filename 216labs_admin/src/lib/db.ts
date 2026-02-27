import Database from "better-sqlite3";
import { existsSync, readdirSync } from "fs";
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

export interface DbEnvVar {
  key: string;
  value: string;
  description: string;
  is_secret: number;
  updated_at: string | null;
}

const DB_PATH =
  process.env.DATABASE_PATH || join(process.cwd(), "..", "216labs.db");
const PROJECTS_ROOT =
  process.env.PROJECTS_ROOT || join(process.cwd(), "..");

const NON_PROJECT_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "build",
  "coverage",
  "__pycache__",
  "venv",
]);

const SPECIAL_APP_IDS: Record<string, string> = {
  "216labs_admin": "admin",
  "RamblingRadio": "ramblingradio",
  "Stroll.live": "stroll",
  "agimemes.com": "agimemes",
};

const SPECIAL_APP_NAMES: Record<string, string> = {
  admin: "216labs Admin",
  ramblingradio: "RamblingRadio",
  stroll: "Stroll.live",
  agimemes: "AGI Memes",
};
const AUTO_DISCOVERED_TAGLINE = "Auto-discovered monorepo project";
const AUTO_DISCOVERED_NOTE = "Auto-discovered. Update metadata in admin DB.";

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
  db.exec(`
    CREATE TABLE IF NOT EXISTS env_vars (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_secret INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );
  `);

  const count = (
    db.prepare("SELECT COUNT(*) as count FROM apps").get() as {
      count: number;
    }
  ).count;
  if (count === 0) {
    seed(db);
    seedEnvVars(db);
  } else {
    // Backfill apps that were added after the initial seed
    backfillAgitShirts(db);
    backfillPriors(db);
    backfillAudioAiCheckup(db);
    backfillStorybook(db);
    backfillEnvVars(db);
  }
  // syncTopLevelProjects must run before metadata backfills so auto-discovered
  // stubs exist for the backfill functions to upgrade with proper metadata.
  syncTopLevelProjects(db);
  backfillBigleroys(db);
  backfillCalibratedAI(db);
  backfill1PageResearch(db);
  backfillArtisinalEurope(db);
  backfillZurichDatingGame(db);
  backfillOneRoom(db);
  backfillKnownPorts(db);
  ensureAdminAlwaysEnabled(db);
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

const DEFAULT_ENV_VARS: Array<{
  key: string;
  description: string;
  is_secret: number;
}> = [
  { key: "RAMBLINGRADIO_DATABASE_URL", description: "RamblingRadio Postgres connection string", is_secret: 1 },
  { key: "PAPERFRAME_API_URL", description: "Paperframe ML backend URL (optional)", is_secret: 0 },
  { key: "PIPESECURE_DATABASE_URL", description: "PipeSecure Postgres connection string", is_secret: 1 },
  { key: "PIPESECURE_NEXTAUTH_URL", description: "PipeSecure public URL", is_secret: 0 },
  { key: "PIPESECURE_NEXTAUTH_SECRET", description: "PipeSecure NextAuth secret", is_secret: 1 },
  { key: "PIPESECURE_GITHUB_CLIENT_ID", description: "PipeSecure GitHub OAuth client ID", is_secret: 1 },
  { key: "PIPESECURE_GITHUB_CLIENT_SECRET", description: "PipeSecure GitHub OAuth client secret", is_secret: 1 },
  { key: "PIPESECURE_GITHUB_APP_ID", description: "PipeSecure GitHub App ID", is_secret: 1 },
  { key: "PIPESECURE_GITHUB_WEBHOOK_SECRET", description: "PipeSecure webhook secret", is_secret: 1 },
  { key: "PIPESECURE_ENCRYPTION_KEY", description: "PipeSecure data encryption key", is_secret: 1 },
  { key: "PIPESECURE_NEXT_PUBLIC_APP_URL", description: "PipeSecure frontend URL", is_secret: 0 },
  { key: "AGIMEMES_NEWS_API_KEY", description: "AGI Memes News API key", is_secret: 1 },
  { key: "AGIMEMES_IMG_FLIP_USERNAME", description: "AGI Memes Imgflip username", is_secret: 1 },
  { key: "AGIMEMES_IMG_FLIP_PASSWORD", description: "AGI Memes Imgflip password", is_secret: 1 },
  { key: "AGITSHIRTS_OPENAI_API_KEY", description: "AgitShirts OpenAI API key", is_secret: 1 },
  { key: "AGITSHIRTS_MODEL", description: "AgitShirts model name", is_secret: 0 },
  { key: "AGITSHIRTS_CHECKOUT_BASE_URL", description: "AgitShirts checkout base URL", is_secret: 0 },
  { key: "PRIORS_SECRET_KEY", description: "Priors Flask secret key", is_secret: 1 },
  { key: "PRIORS_OAUTH_REDIRECT_URI", description: "Priors OAuth redirect URL", is_secret: 0 },
  { key: "PRIORS_GOOGLE_CLIENT_ID", description: "Priors Google client ID", is_secret: 1 },
  { key: "PRIORS_GEMINI_API_KEY", description: "Priors Gemini API key", is_secret: 1 },
  { key: "ONEROOM_LLM_PROVIDER", description: "OneRoom LLM provider: openai or gemini (default: openai)", is_secret: 0 },
  { key: "ONEROOM_OPENAI_API_KEY", description: "OneRoom OpenAI API key (server-side)", is_secret: 1 },
  { key: "ONEROOM_GEMINI_API_KEY", description: "OneRoom Gemini API key (server-side)", is_secret: 1 },
  { key: "ONEFIT_LLM_PROVIDER", description: "OneFit LLM provider: openai or gemini (default: openai)", is_secret: 0 },
  { key: "ONEFIT_OPENAI_API_KEY", description: "OneFit OpenAI API key (server-side)", is_secret: 1 },
  { key: "ONEFIT_GEMINI_API_KEY", description: "OneFit Gemini API key (server-side)", is_secret: 1 },
  { key: "CALIBRATEDAI_OPENROUTER_API_KEY", description: "CalibratedAI OpenRouter API key", is_secret: 1 },
  { key: "BIGLEROYS_SECRET_KEY", description: "BigLeRoys Flask secret key", is_secret: 1 },
  { key: "BIGLEROYS_GOOGLE_CLIENT_ID", description: "BigLeRoys Google OAuth client ID", is_secret: 1 },
  { key: "BIGLEROYS_OAUTH_REDIRECT_URI", description: "BigLeRoys OAuth redirect URI (default: https://bigleroys.agimemes.com/callback)", is_secret: 0 },
  { key: "ONEPAGE_OPENROUTER_API_KEY", description: "1PageResearch OpenRouter API key", is_secret: 1 },
  { key: "ONEPAGE_MODEL", description: "1PageResearch model name (default: google/gemini-2.0-flash-001)", is_secret: 0 },
  { key: "ZDGAME_ADMIN_KEY", description: "Zurich Dating Game admin secret key", is_secret: 1 },
  { key: "ZDGAME_OPENROUTER_API_KEY", description: "Zurich Dating Game OpenRouter API key", is_secret: 1 },
  { key: "ZDGAME_MODEL", description: "Zurich Dating Game model name (default: google/gemini-2.0-flash-001)", is_secret: 0 },
  { key: "AUDIOAICHECKUP_OPENAI_API_KEY", description: "Audio AI Checkup OpenAI API key (for gpt-4o-audio-preview)", is_secret: 1 },
  { key: "AUDIOAICHECKUP_GEMINI_API_KEY", description: "Audio AI Checkup Gemini API key (for gemini-2.0-flash and gemini-1.5-pro)", is_secret: 1 },
  { key: "STORYBOOK_OPENAI_API_KEY", description: "StoryMagic OpenAI API key (GPT-4o story generation + DALL-E 3 illustrations)", is_secret: 1 },
  { key: "STORYBOOK_STRIPE_SECRET_KEY", description: "StoryMagic Stripe secret key (sk_live_...)", is_secret: 1 },
  { key: "STORYBOOK_STRIPE_WEBHOOK_SECRET", description: "StoryMagic Stripe webhook signing secret (whsec_...)", is_secret: 1 },
  { key: "NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY", description: "StoryMagic Stripe publishable key (pk_live_...)", is_secret: 0 },
  { key: "STORYBOOK_BOOK_PRICE_CENTS", description: "StoryMagic printed book price in cents (default: 2499 = $24.99)", is_secret: 0 },
  { key: "STORYBOOK_ADMIN_TOKEN", description: "StoryMagic shared secret for admin→storybook API calls", is_secret: 1 },
  { key: "STORYBOOK_RESEND_API_KEY", description: "StoryMagic Resend API key for order notification emails", is_secret: 1 },
  { key: "STORYBOOK_ADMIN_EMAIL", description: "StoryMagic email address to notify on new orders", is_secret: 0 },
  { key: "STORYBOOK_FROM_EMAIL", description: "StoryMagic sender address (e.g. StoryMagic <orders@yourdomain.com>)", is_secret: 0 },
  { key: "STORYBOOK_INTERNAL_URL", description: "StoryMagic internal Docker URL for admin to query orders (http://storybook:3000)", is_secret: 0 },
];

function seedEnvVars(db: Database.Database) {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO env_vars (key, value, description, is_secret, updated_at)
    VALUES (@key, '', @description, @is_secret, NULL)
  `);
  const insertMany = db.transaction((rows: typeof DEFAULT_ENV_VARS) => {
    for (const row of rows) insert.run(row);
  });
  insertMany(DEFAULT_ENV_VARS);
}

function backfillAudioAiCheckup(db: Database.Database) {
  const exists = (
    db.prepare("SELECT COUNT(*) as count FROM apps WHERE id = 'audioaicheckup'").get() as {
      count: number;
    }
  ).count;

  if (exists > 0) return;

  const today = new Date().toISOString().split("T")[0];
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
    id: "audioaicheckup",
    name: "Audio AI Checkup",
    tagline: "Benchmark multimodal LLMs on audio",
    description:
      "Record audio (up to 30 min) and provide a question with a verifiable answer. GPT-4o Audio, Gemini 2.0 Flash, and Gemini 1.5 Pro are evaluated simultaneously — compare which models correctly classify audio.",
    category: "ai",
    port: 8018,
    docker_service: "audioaicheckup",
    docker_image: "216labs/audioaicheckup:latest",
    directory: "audioaicheckup",
    repo_path: "audioaicheckup",
    stack_frontend: "Next.js 14",
    stack_backend: null,
    stack_database: "SQLite (better-sqlite3)",
    stack_other: '["OpenAI gpt-4o-audio-preview","Gemini 2.0 Flash","Gemini 1.5 Pro","ffmpeg"]',
    deploy_enabled: 1,
    image_size_mb: null,
    memory_limit: "512 MB",
    created_at: today,
    last_updated: today,
    total_commits: 1,
    marketing_monthly: 0,
    marketing_channel: "Organic",
    marketing_notes: null,
  });
}

function backfillStorybook(db: Database.Database) {
  const exists = (
    db.prepare("SELECT COUNT(*) as count FROM apps WHERE id = 'storybook'").get() as {
      count: number;
    }
  ).count;

  if (exists > 0) return;

  const today = new Date().toISOString().split("T")[0];
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
    id: "storybook",
    name: "StoryMagic",
    tagline: "AI-generated personalised children's storybooks",
    description:
      "Enter a child's age, name, and story idea — AI writes and illustrates a full colour 6-page children's storybook. Order a professionally printed hardback via Stripe checkout.",
    category: "ai",
    port: 8019,
    docker_service: "storybook",
    docker_image: "216labs/storybook:latest",
    directory: "storybook",
    repo_path: "storybook",
    stack_frontend: "Next.js 14",
    stack_backend: null,
    stack_database: "SQLite (better-sqlite3)",
    stack_other: '["OpenAI GPT-4o","DALL-E 3","Stripe","Framer Motion"]',
    deploy_enabled: 1,
    image_size_mb: null,
    memory_limit: "256 MB",
    created_at: today,
    last_updated: today,
    total_commits: 1,
    marketing_monthly: 0,
    marketing_channel: "Organic",
    marketing_notes: "Print-on-demand revenue via Stripe",
  });
}

function backfillAppMetadata(
  db: Database.Database,
  id: string,
  data: {
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
    memory_limit: string;
    created_at: string;
  }
) {
  const row = db
    .prepare("SELECT tagline FROM apps WHERE id = ?")
    .get(id) as { tagline: string } | undefined;

  if (!row) return;
  if (row.tagline !== AUTO_DISCOVERED_TAGLINE) return;

  db.prepare(`
    UPDATE apps SET
      name = @name, tagline = @tagline, description = @description,
      category = @category, port = @port,
      docker_service = @docker_service, docker_image = @docker_image,
      directory = @directory, repo_path = @repo_path,
      stack_frontend = @stack_frontend, stack_backend = @stack_backend,
      stack_database = @stack_database, stack_other = @stack_other,
      deploy_enabled = @deploy_enabled, memory_limit = @memory_limit,
      created_at = @created_at, marketing_notes = NULL
    WHERE id = @id
  `).run({ ...data, id });
}

function backfillBigleroys(db: Database.Database) {
  backfillAppMetadata(db, "bigleroys", {
    name: "BigLeRoys",
    tagline: "Premier League prediction game",
    description:
      "Flask + Google OAuth app for predicting Premier League match results. Tracks points across gameweeks with automated fixture syncing and leaderboards.",
    category: "consumer",
    port: 8012,
    docker_service: "bigleroys",
    docker_image: "216labs/bigleroys:latest",
    directory: "bigleroys",
    repo_path: "bigleroys",
    stack_frontend: "Flask templates + Jinja2",
    stack_backend: "Flask + Python + Gunicorn",
    stack_database: "SQLite",
    stack_other: '["Google OAuth","APScheduler","Premier League API"]',
    deploy_enabled: 1,
    memory_limit: "256 MB",
    created_at: "2026-02-01",
  });
}

function backfillCalibratedAI(db: Database.Database) {
  backfillAppMetadata(db, "calibratedai", {
    name: "CalibratedAI",
    tagline: "AI probability calibration dashboard",
    description:
      "Track and improve your AI predictions by comparing estimated probabilities against real outcomes. Powered by OpenRouter for AI-assisted calibration analysis.",
    category: "ai",
    port: 8011,
    docker_service: "calibratedai",
    docker_image: "216labs/calibratedai:latest",
    directory: "calibratedai",
    repo_path: "calibratedai",
    stack_frontend: "Next.js",
    stack_backend: null,
    stack_database: "SQLite (better-sqlite3)",
    stack_other: '["OpenRouter API"]',
    deploy_enabled: 1,
    memory_limit: "256 MB",
    created_at: "2026-02-01",
  });
}

function backfill1PageResearch(db: Database.Database) {
  backfillAppMetadata(db, "1pageresearch", {
    name: "1PageResearch",
    tagline: "AI-generated one-page research reports",
    description:
      "Enter any topic and get a concise, rigorous one-page research report generated by AI — complete with effect sizes, p-values, and source communities.",
    category: "ai",
    port: 8014,
    docker_service: "1pageresearch",
    docker_image: "216labs/1pageresearch:latest",
    directory: "1pageresearch",
    repo_path: "1pageresearch",
    stack_frontend: "Flask templates + Jinja2",
    stack_backend: "Flask + Python + Gunicorn",
    stack_database: "SQLite",
    stack_other: '["OpenRouter API","Server-Sent Events"]',
    deploy_enabled: 1,
    memory_limit: "128 MB",
    created_at: "2026-02-01",
  });
}

function backfillArtisinalEurope(db: Database.Database) {
  backfillAppMetadata(db, "artisinaleurope", {
    name: "ArtisinalEurope",
    tagline: "European artisan experiences directory",
    description:
      "Discover and book authentic artisan experiences across Europe — from cheese-making in France to pottery in Portugal.",
    category: "consumer",
    port: 8015,
    docker_service: "artisinaleurope",
    docker_image: "216labs/artisinaleurope:latest",
    directory: "artisinaleurope",
    repo_path: "artisinaleurope",
    stack_frontend: "Next.js",
    stack_backend: null,
    stack_database: null,
    stack_other: null,
    deploy_enabled: 1,
    memory_limit: "256 MB",
    created_at: "2026-02-01",
  });
}

function backfillZurichDatingGame(db: Database.Database) {
  backfillAppMetadata(db, "thezurichdatinggame", {
    name: "The Zurich Dating Game",
    tagline: "AI-powered dating event matchmaker",
    description:
      "Speed-dating meets AI — participants register and get AI-generated match scores and conversation starters before the event. Built for live dating events in Zurich.",
    category: "consumer",
    port: 8016,
    docker_service: "thezurichdatinggame",
    docker_image: "216labs/thezurichdatinggame:latest",
    directory: "thezurichdatinggame",
    repo_path: "thezurichdatinggame",
    stack_frontend: "Next.js",
    stack_backend: null,
    stack_database: "SQLite (better-sqlite3)",
    stack_other: '["OpenRouter API"]',
    deploy_enabled: 1,
    memory_limit: "256 MB",
    created_at: "2026-02-01",
  });
}

function backfillOneRoom(db: Database.Database) {
  backfillAppMetadata(db, "oneroom", {
    name: "OneRoom",
    tagline: "AI room designer",
    description:
      "Upload a photo of any room and get AI-generated redesign suggestions. Supports OpenAI GPT-4o Vision and Google Gemini for analysis and visualization.",
    category: "ai",
    port: 8017,
    docker_service: "oneroom",
    docker_image: "216labs/oneroom:latest",
    directory: "oneroom",
    repo_path: "oneroom",
    stack_frontend: "Next.js",
    stack_backend: null,
    stack_database: "SQLite (better-sqlite3)",
    stack_other: '["OpenAI GPT-4o Vision","Google Gemini","DALL-E 3"]',
    deploy_enabled: 1,
    memory_limit: "256 MB",
    created_at: "2026-02-01",
  });
}

function backfillEnvVars(db: Database.Database) {
  seedEnvVars(db);
}

// Known ports for apps that may have been auto-discovered with port=0.
const KNOWN_PORTS: Record<string, number> = {
  ramblingradio: 8001,
  stroll: 8002,
  onefit: 8003,
  paperframe: 8004,
  hivefind: 8005,
  pipesecure: 8006,
  admin: 8007,
  agimemes: 8008,
  agitshirts: 8009,
  priors: 8010,
  calibratedai: 8011,
  bigleroys: 8012,
  "1pageresearch": 8014,
  artisinaleurope: 8015,
  thezurichdatinggame: 8016,
  oneroom: 8017,
  audioaicheckup: 8018,
  storybook: 8019,
};

function backfillKnownPorts(db: Database.Database) {
  const update = db.prepare(
    "UPDATE apps SET port = ? WHERE id = ? AND port = 0"
  );
  const run = db.transaction(() => {
    for (const [id, port] of Object.entries(KNOWN_PORTS)) {
      update.run(port, id);
    }
  });
  run();
}

function normalizeAppId(directory: string): string {
  const specialId = SPECIAL_APP_IDS[directory];
  if (specialId) return specialId;
  return directory
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDisplayName(directory: string, id: string): string {
  return (
    SPECIAL_APP_NAMES[id] ||
    directory
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (match) => match.toUpperCase())
  );
}

function discoverTopLevelProjects() {
  if (!existsSync(PROJECTS_ROOT)) return [];

  return readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !NON_PROJECT_DIRS.has(entry.name) &&
        existsSync(join(PROJECTS_ROOT, entry.name, "Dockerfile"))
    )
    .map((entry) => entry.name);
}

function pruneInvalidAutoDiscoveredApps(db: Database.Database, validDirs: Set<string>) {
  const rows = db
    .prepare("SELECT id, repo_path, tagline, marketing_notes FROM apps")
    .all() as Array<{
    id: string;
    repo_path: string;
    tagline: string | null;
    marketing_notes: string | null;
  }>;

  const removableIds = rows
    .filter((row) => {
      const autoDiscovered =
        row.tagline === AUTO_DISCOVERED_TAGLINE ||
        row.marketing_notes === AUTO_DISCOVERED_NOTE;
      return autoDiscovered && !validDirs.has(row.repo_path);
    })
    .map((row) => row.id);

  if (removableIds.length === 0) return;

  const removeOne = db.prepare("DELETE FROM apps WHERE id = ?");
  const removeMany = db.transaction((ids: string[]) => {
    for (const id of ids) removeOne.run(id);
  });
  removeMany(removableIds);
}

function syncTopLevelProjects(db: Database.Database) {
  const discoveredDirs = discoverTopLevelProjects();
  pruneInvalidAutoDiscoveredApps(db, new Set(discoveredDirs));
  if (discoveredDirs.length === 0) return;

  const existingRows = db
    .prepare("SELECT id, repo_path FROM apps")
    .all() as Array<{ id: string; repo_path: string }>;
  const existingIds = new Set(existingRows.map((row) => row.id));
  const existingRepoPaths = new Set(existingRows.map((row) => row.repo_path));
  const today = new Date().toISOString().split("T")[0];

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

  const insertMany = db.transaction((dirs: string[]) => {
    for (const dir of dirs) {
      if (existingRepoPaths.has(dir)) continue;
      const id = normalizeAppId(dir);
      if (!id || existingIds.has(id)) continue;

      const isAdmin = id === "admin";
      insert.run({
        id,
        name: toDisplayName(dir, id),
        tagline: AUTO_DISCOVERED_TAGLINE,
        description:
          "Automatically discovered from top-level directories in the 216labs repo.",
        category: isAdmin ? "admin" : "tool",
        port: 0,
        docker_service: isAdmin ? "admin" : id,
        docker_image: `216labs/${isAdmin ? "admin" : id}:latest`,
        directory: dir,
        repo_path: dir,
        stack_frontend: null,
        stack_backend: null,
        stack_database: null,
        stack_other: null,
        deploy_enabled: isAdmin ? 1 : 0,
        image_size_mb: null,
        memory_limit: "256 MB",
        created_at: today,
        last_updated: today,
        total_commits: 0,
        marketing_monthly: 0,
        marketing_channel: "Organic",
        marketing_notes: AUTO_DISCOVERED_NOTE,
      });

      existingIds.add(id);
      existingRepoPaths.add(dir);
    }
  });

  insertMany(discoveredDirs);
}

function ensureAdminAlwaysEnabled(db: Database.Database) {
  db.prepare("UPDATE apps SET deploy_enabled = 1 WHERE id = 'admin'").run();
}

export function getAllApps(): DbApp[] {
  const db = getDb();
  syncTopLevelProjects(db);
  ensureAdminAlwaysEnabled(db);
  return db.prepare("SELECT * FROM apps ORDER BY port").all() as DbApp[];
}

export function getAllEnvVars(): DbEnvVar[] {
  return getDb()
    .prepare("SELECT * FROM env_vars ORDER BY key")
    .all() as DbEnvVar[];
}

export function getEnabledApps(): DbApp[] {
  return getDb()
    .prepare("SELECT * FROM apps WHERE deploy_enabled = 1 ORDER BY port")
    .all() as DbApp[];
}

export function setDeployEnabled(appId: string, enabled: boolean): void {
  // Keep admin dashboard always deployable so deployment controls never disappear.
  const nextEnabled = appId === "admin" ? 1 : enabled ? 1 : 0;
  getDb()
    .prepare("UPDATE apps SET deploy_enabled = ? WHERE id = ?")
    .run(nextEnabled, appId);
}

export function setEnvVarValue(key: string, value: string): void {
  getDb()
    .prepare(
      "UPDATE env_vars SET value = ?, updated_at = date('now') WHERE key = ?"
    )
    .run(value, key);
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
