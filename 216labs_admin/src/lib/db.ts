import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";

const BOOTSTRAP_FILE = "config/deploy-bootstrap.txt";

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
  /** Set by apps/activator; optional on older DBs until migration runs */
  runtime_status?: string | null;
  last_runtime_error?: string | null;
  last_started_at?: string | null;
  last_accessed_at?: string | null;
}

export interface DbEnvVar {
  key: string;
  value: string;
  description: string;
  is_secret: number;
  updated_at: string | null;
}

interface AppManifest {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  internal_port: number;
  memory_limit: string;
  docker_service?: string;
  build_context: string;
  build_dockerfile?: string | null;
  stack?: {
    frontend?: string | null;
    backend?: string | null;
    database?: string | null;
    other?: string[] | null;
  };
  env_vars?: Array<{
    key: string;
    description: string;
    is_secret: boolean;
  }>;
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
  "scripts",
  "apps", // container for general apps; we scan apps/* separately
]);

const AUTO_DISCOVERED_TAGLINE = "Vibe coding workflow project";
const AUTO_DISCOVERED_NOTE = "Auto-discovered. Refine name and metadata in the workflow dashboard.";

// Ports assigned before the manifest system. Kept so that existing DB rows
// with port=0 (from pre-manifest auto-discovery) get corrected on startup.
const KNOWN_PORTS: Record<string, number> = {
  ramblingradio: 8001,
  stroll: 8002,
  onefit: 8003,
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
  muinteoir: 8020,
  pocket: 8021,
  happypath: 8022,
  blog: 8023,
  worldphoto: 8024,
  offlinellm: 8025,
  facerate: 8026,
  landing: 8027,
  crowdbulk: 8028,
  "cron-runner": 8029,
  emailgpt: 8030,
  mysteryshopper: 8031,
  llminternals: 8032,
  maxlearn: 8033,
  impulse: 8034,
  mediate: 8035,
  avatar: 8036,
  activator: 8037,
  germandaily: 8038,
  russiandaily: 8046,
  valentine: 8039,
  tigertank: 8040,
  explore: 8041,
  angelwatcher: 8042,
  shannonairport: 8043,
  onefitblog: 8044,
  marketing: 8045,
};

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

/** Activator service updates these columns; add if DB predates activator. */
function ensureActivatorRuntimeColumns(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(apps)").all() as { name: string }[];
  const have = new Set(cols.map((c) => c.name));
  const add = (name: string, ddl: string) => {
    if (!have.has(name)) {
      db.exec(ddl);
      have.add(name);
    }
  };
  add("runtime_status", "ALTER TABLE apps ADD COLUMN runtime_status TEXT");
  add("last_runtime_error", "ALTER TABLE apps ADD COLUMN last_runtime_error TEXT");
  add("last_started_at", "ALTER TABLE apps ADD COLUMN last_started_at TEXT");
  add("last_accessed_at", "ALTER TABLE apps ADD COLUMN last_accessed_at TEXT");
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
  ensureActivatorRuntimeColumns(db);
  // env_vars: secrets (e.g. PIPESECURE_GITHUB_TOKEN) live here. Never bulk-delete or
  // truncate this table; only INSERT OR IGNORE new keys from manifests and UPDATE value on user save.
  db.exec(`
    CREATE TABLE IF NOT EXISTS env_vars (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_secret INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  seedDefaultCronJobs(db);

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_analytics (
      app_id TEXT PRIMARY KEY REFERENCES apps(id) ON DELETE CASCADE,
      visits_30d INTEGER NOT NULL DEFAULT 0,
      conversions_30d INTEGER NOT NULL DEFAULT 0,
      revenue_proxy_30d REAL NOT NULL DEFAULT 0,
      notes TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS todo_columns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS todo_cards (
      id TEXT PRIMARY KEY,
      column_id TEXT NOT NULL REFERENCES todo_columns(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  seedTodoColumnsIfEmpty(db);

  syncTopLevelProjects(db);
  backfillAppAnalytics(db);
  backfillKnownPorts(db);
  ensureAdminAlwaysEnabled(db);
  ensureBootstrapFromFile(db);
  seedInfraEnvDefaults(db);
}

/** Default admin logging channel and cron-runner URL. Only sets when value is empty. */
function seedInfraEnvDefaults(db: Database.Database) {
  const ADMIN_LOGGING_CHAT_ID = "-1002253649080";
  db.prepare(
    `UPDATE env_vars SET value = ? WHERE key = 'TELEGRAM_CHAT_ID' AND (value = '' OR value IS NULL)`
  ).run(ADMIN_LOGGING_CHAT_ID);
  db.prepare(
    `UPDATE env_vars SET value = 'http://cron-runner:3029' WHERE key = 'CRON_RUNNER_INTERNAL_URL' AND (value = '' OR value IS NULL)`
  ).run();
}

function readManifest(manifestPath: string): AppManifest | null {
  try {
    if (!existsSync(manifestPath)) return null;
    return JSON.parse(readFileSync(manifestPath, "utf-8")) as AppManifest;
  } catch {
    return null;
  }
}

function manifestToStackOther(manifest: AppManifest): string | null {
  const other = manifest.stack?.other;
  if (!other || other.length === 0) return null;
  return JSON.stringify(other);
}

function getNextPort(db: Database.Database): number {
  const result = db
    .prepare("SELECT MAX(port) as max_port FROM apps")
    .get() as { max_port: number | null };
  return Math.max((result.max_port ?? 8019) + 1, 8020);
}

/** Add env var keys from manifest only; never overwrite or delete existing values. */
function upsertEnvVarsFromManifest(
  db: Database.Database,
  manifest: AppManifest
) {
  if (!manifest.env_vars?.length) return;
  // INSERT OR IGNORE: add new keys with empty value; existing rows (and their values) are untouched.
  const insert = db.prepare(`
    INSERT OR IGNORE INTO env_vars (key, value, description, is_secret, updated_at)
    VALUES (@key, '', @description, @is_secret, NULL)
  `);
  const insertMany = db.transaction(
    (vars: NonNullable<AppManifest["env_vars"]>) => {
      for (const v of vars) {
        insert.run({
          key: v.key,
          description: v.description,
          is_secret: v.is_secret ? 1 : 0,
        });
      }
    }
  );
  insertMany(manifest.env_vars);
}

function discoverTopLevelProjects(): string[] {
  if (!existsSync(PROJECTS_ROOT)) return [];

  const rootDirs = readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !NON_PROJECT_DIRS.has(entry.name) &&
        (existsSync(join(PROJECTS_ROOT, entry.name, "Dockerfile")) ||
          existsSync(join(PROJECTS_ROOT, entry.name, "manifest.json")))
    )
    .map((entry) => entry.name);

  const appsDir = join(PROJECTS_ROOT, "apps");
  if (!existsSync(appsDir)) return rootDirs;

  const appSubdirs = readdirSync(appsDir, { withFileTypes: true })
    .filter(
      (entry: import("fs").Dirent) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        (existsSync(join(appsDir, entry.name, "Dockerfile")) ||
          existsSync(join(appsDir, entry.name, "manifest.json"))))
    .map((entry: import("fs").Dirent) => `apps/${entry.name}`);

  return [...rootDirs, ...appSubdirs];
}

function normalizeAppId(directory: string): string {
  return directory
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDisplayName(directory: string): string {
  return directory
    .replace(/[-_.]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function pruneInvalidAutoDiscoveredApps(
  db: Database.Database,
  validDirs: Set<string>
) {
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

/** Remove app rows whose directory no longer exists on disk (e.g. app was deleted). */
function pruneRemovedDirectories(
  db: Database.Database,
  validDirs: Set<string>
) {
  const rows = db
    .prepare("SELECT id, repo_path FROM apps")
    .all() as Array<{ id: string; repo_path: string }>;
  const removableIds = rows
    .filter(
      (row) => row.id !== "admin" && !validDirs.has(row.repo_path)
    )
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
  const validDirs = new Set(discoveredDirs);
  pruneInvalidAutoDiscoveredApps(db, validDirs);
  pruneRemovedDirectories(db, validDirs);
  if (discoveredDirs.length === 0) return;

  const existingRows = db
    .prepare("SELECT id, repo_path, port FROM apps")
    .all() as Array<{ id: string; repo_path: string; port: number }>;
  const existingById = new Map(existingRows.map((row) => [row.id, row]));
  const existingByRepoPath = new Map(
    existingRows.map((row) => [row.repo_path, row])
  );
  const today = new Date().toISOString().split("T")[0];

  const insertStmt = db.prepare(`
    INSERT INTO apps (
      id, name, tagline, description, category, port,
      docker_service, docker_image, directory, repo_path,
      stack_frontend, stack_backend, stack_database, stack_other,
      deploy_enabled, memory_limit,
      created_at, last_updated, total_commits,
      marketing_monthly, marketing_channel, marketing_notes
    ) VALUES (
      @id, @name, @tagline, @description, @category, @port,
      @docker_service, @docker_image, @directory, @repo_path,
      @stack_frontend, @stack_backend, @stack_database, @stack_other,
      @deploy_enabled, @memory_limit,
      @created_at, @last_updated, @total_commits,
      @marketing_monthly, @marketing_channel, @marketing_notes
    )
  `);

  // Updates only static metadata from the manifest — never touches runtime
  // fields (deploy_enabled, image_size_mb, startup_time_ms, marketing_*, etc.)
  const updateFromManifest = db.prepare(`
    UPDATE apps SET
      name = @name, tagline = @tagline, description = @description,
      category = @category, docker_service = @docker_service,
      docker_image = @docker_image, directory = @directory, repo_path = @repo_path,
      stack_frontend = @stack_frontend, stack_backend = @stack_backend,
      stack_database = @stack_database, stack_other = @stack_other,
      memory_limit = @memory_limit
    WHERE id = @id
  `);

  const sync = db.transaction((dirs: string[]) => {
    for (const dir of dirs) {
      const manifest = readManifest(
        join(PROJECTS_ROOT, dir, "manifest.json")
      );

      if (manifest) {
        const id = manifest.id;
        const docker_service = manifest.docker_service ?? id;
        const fields = {
          id,
          name: manifest.name,
          tagline: manifest.tagline,
          description: manifest.description,
          category: manifest.category,
          docker_service,
          docker_image: `216labs/${docker_service}:latest`,
          directory: dir,
          repo_path: dir,
          stack_frontend: manifest.stack?.frontend ?? null,
          stack_backend: manifest.stack?.backend ?? null,
          stack_database: manifest.stack?.database ?? null,
          stack_other: manifestToStackOther(manifest),
          memory_limit: manifest.memory_limit ?? "256m",
        };

        const existing = existingById.get(id) ?? existingByRepoPath.get(dir);
        if (existing) {
          updateFromManifest.run(fields);
        } else {
          const port = KNOWN_PORTS[id] ?? getNextPort(db);
          insertStmt.run({
            ...fields,
            port,
            deploy_enabled: id === "admin" ? 1 : 0,
            created_at: today,
            last_updated: today,
            total_commits: 0,
            marketing_monthly: 0,
            marketing_channel: "Organic",
            marketing_notes: null,
          });
          existingById.set(id, { id, repo_path: dir, port });
          existingByRepoPath.set(dir, { id, repo_path: dir, port });
        }

        upsertEnvVarsFromManifest(db, manifest);
      } else {
        // No manifest — create a stub so the app appears in the admin UI.
        // A manifest.json should be added to give it real metadata.
        if (existingByRepoPath.has(dir)) continue;
        const id = normalizeAppId(dir);
        if (!id || existingById.has(id)) continue;

        const isAdmin = id === "admin";
        const port = KNOWN_PORTS[id] ?? getNextPort(db);
        insertStmt.run({
          id,
          name: toDisplayName(dir),
          tagline: AUTO_DISCOVERED_TAGLINE,
          description:
            "Discovered from top-level directories in the 216labs workflow monorepo.",
          category: isAdmin ? "admin" : "tool",
          port,
          docker_service: id,
          docker_image: `216labs/${id}:latest`,
          directory: dir,
          repo_path: dir,
          stack_frontend: null,
          stack_backend: null,
          stack_database: null,
          stack_other: null,
          deploy_enabled: isAdmin ? 1 : 0,
          memory_limit: "256m",
          created_at: today,
          last_updated: today,
          total_commits: 0,
          marketing_monthly: 0,
          marketing_channel: "Organic",
          marketing_notes: AUTO_DISCOVERED_NOTE,
        });

        existingById.set(id, { id, repo_path: dir, port });
        existingByRepoPath.set(dir, { id, repo_path: dir, port });
      }
    }
  });

  sync(discoveredDirs);
}

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

function ensureAdminAlwaysEnabled(db: Database.Database) {
  db.prepare("UPDATE apps SET deploy_enabled = 1 WHERE id = 'admin'").run();
}

/** Set deploy_enabled=1 for app IDs listed in config/deploy-bootstrap.txt (one per line). Scale: edit file, not code. */
function ensureBootstrapFromFile(db: Database.Database) {
  const path = join(PROJECTS_ROOT, BOOTSTRAP_FILE);
  if (!existsSync(path)) return;
  const content = readFileSync(path, "utf-8");
  const update = db.prepare(
    "UPDATE apps SET deploy_enabled = 1 WHERE id = ?"
  );
  const run = db.transaction(() => {
    for (const line of content.split(/\r?\n/)) {
      const id = line.replace(/#.*/, "").trim();
      if (id) update.run(id);
    }
  });
  run();
}

export function getAllApps(): DbApp[] {
  const db = getDb();
  syncTopLevelProjects(db);
  ensureAdminAlwaysEnabled(db);
  ensureBootstrapFromFile(db);
  return db.prepare("SELECT * FROM apps ORDER BY port").all() as DbApp[];
}

/** Apps with a recorded deploy time, most recent first (dashboard “Recent Activity”). */
export function getRecentDeploymentActivity(limit = 12): DbApp[] {
  const db = getDb();
  syncTopLevelProjects(db);
  ensureAdminAlwaysEnabled(db);
  ensureBootstrapFromFile(db);
  return db
    .prepare(
      `SELECT * FROM apps
       WHERE last_deployed_at IS NOT NULL AND TRIM(last_deployed_at) != ''
       ORDER BY last_deployed_at DESC
       LIMIT ?`,
    )
    .all(limit) as DbApp[];
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

export interface DbCronJob {
  id: string;
  name: string;
  description: string;
  schedule: string;
  enabled: number;
  last_run_at: string | null;
  created_at: string | null;
}

function seedDefaultCronJobs(db: Database.Database): void {
  const existing = db.prepare("SELECT 1 FROM cron_jobs LIMIT 1").get();
  if (existing) return;
  db.exec(`
    INSERT INTO cron_jobs (id, name, description, schedule, enabled) VALUES
    ('telegram-daily-digest', 'Daily codebase digest', 'Summarise repo activity and open PRs/issues; post to Telegram.', '0 9 * * *', 0),
    ('telegram-weekly-lint', 'Weekly lint & quality report', 'Run lint/formatter checks and report findings to Telegram.', '0 9 * * 1', 0),
    ('telegram-security-summary', 'Security scan summary', 'PipeSecure/Semgrep findings summary posted to Telegram.', '0 10 * * *', 0),
    ('telegram-happypath-summary', 'Happy Path run summary', 'Last Happy Path results per app posted to Telegram.', '0 8 * * *', 0);
  `);
}

export interface DbAppAnalytics {
  app_id: string;
  visits_30d: number;
  conversions_30d: number;
  revenue_proxy_30d: number;
  notes: string | null;
  updated_at: string | null;
}

function backfillAppAnalytics(db: Database.Database): void {
  const insert = db.prepare(`
    INSERT OR IGNORE INTO app_analytics (app_id, visits_30d, conversions_30d, revenue_proxy_30d)
    SELECT id, 0, 0, 0 FROM apps
  `);
  insert.run();
}

export function getCronJobs(): DbCronJob[] {
  return getDb()
    .prepare("SELECT * FROM cron_jobs ORDER BY name")
    .all() as DbCronJob[];
}

export function setCronJobEnabled(id: string, enabled: boolean): void {
  getDb()
    .prepare("UPDATE cron_jobs SET enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, id);
}

export function getAppAnalyticsMap(): Record<string, DbAppAnalytics> {
  const rows = getDb()
    .prepare("SELECT * FROM app_analytics")
    .all() as DbAppAnalytics[];
  const map: Record<string, DbAppAnalytics> = {};
  for (const r of rows) map[r.app_id] = r;
  return map;
}

function seedTodoColumnsIfEmpty(db: Database.Database): void {
  const row = db.prepare("SELECT COUNT(*) as c FROM todo_columns").get() as {
    c: number;
  };
  if (row.c > 0) return;
  db.exec(`
    INSERT INTO todo_columns (id, title, sort_order, created_at) VALUES
    ('col_backlog', 'Backlog', 0, datetime('now')),
    ('col_doing', 'In progress', 1, datetime('now')),
    ('col_done', 'Done', 2, datetime('now'));
  `);
}

export interface DbTodoColumn {
  id: string;
  title: string;
  sort_order: number;
  created_at: string | null;
}

export interface DbTodoCard {
  id: string;
  column_id: string;
  title: string;
  body: string;
  sort_order: number;
  created_at: string | null;
  updated_at: string | null;
}

export type DbTodoBoardColumn = DbTodoColumn & { cards: DbTodoCard[] };

export function getTodoBoard(): DbTodoBoardColumn[] {
  const db = getDb();
  seedTodoColumnsIfEmpty(db);
  const columns = db
    .prepare("SELECT * FROM todo_columns ORDER BY sort_order ASC, id ASC")
    .all() as DbTodoColumn[];
  const cards = db
    .prepare("SELECT * FROM todo_cards ORDER BY column_id, sort_order ASC, id ASC")
    .all() as DbTodoCard[];
  const byCol = new Map<string, DbTodoCard[]>();
  for (const c of cards) {
    const arr = byCol.get(c.column_id) ?? [];
    arr.push(c);
    byCol.set(c.column_id, arr);
  }
  return columns.map((col) => ({
    ...col,
    cards: byCol.get(col.id) ?? [],
  }));
}

export function createTodoCard(
  columnId: string,
  title: string,
  body?: string
): string {
  const db = getDb();
  const id = randomUUID();
  const maxRow = db
    .prepare(
      "SELECT COALESCE(MAX(sort_order), -1) as m FROM todo_cards WHERE column_id = ?"
    )
    .get(columnId) as { m: number };
  const sort_order = maxRow.m + 1;
  db.prepare(
    `INSERT INTO todo_cards (id, column_id, title, body, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(id, columnId, title.trim(), (body ?? "").trim(), sort_order);
  return id;
}

export function updateTodoCard(
  cardId: string,
  data: { title?: string; body?: string | null }
): void {
  const db = getDb();
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: (string | null)[] = [];
  if (data.title !== undefined) {
    sets.push("title = ?");
    values.push(data.title.trim());
  }
  if (data.body !== undefined) {
    sets.push("body = ?");
    values.push(data.body ?? "");
  }
  if (values.length === 0) return;
  values.push(cardId);
  db.prepare(`UPDATE todo_cards SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function deleteTodoCard(cardId: string): void {
  const db = getDb();
  const row = db
    .prepare("SELECT column_id FROM todo_cards WHERE id = ?")
    .get(cardId) as { column_id: string } | undefined;
  if (!row) return;
  db.prepare("DELETE FROM todo_cards WHERE id = ?").run(cardId);
  const rest = db
    .prepare(
      "SELECT id FROM todo_cards WHERE column_id = ? ORDER BY sort_order ASC, id ASC"
    )
    .all(row.column_id) as { id: string }[];
  rest.forEach((r, i) => {
    db.prepare("UPDATE todo_cards SET sort_order = ? WHERE id = ?").run(i, r.id);
  });
}

export function moveTodoCard(
  cardId: string,
  toColumnId: string,
  toIndex: number
): void {
  const db = getDb();
  const card = db
    .prepare("SELECT * FROM todo_cards WHERE id = ?")
    .get(cardId) as DbTodoCard | undefined;
  if (!card) return;

  const run = db.transaction(() => {
    const fromId = card.column_id;

    if (fromId === toColumnId) {
      const all = (
        db
          .prepare(
            "SELECT * FROM todo_cards WHERE column_id = ? ORDER BY sort_order ASC, id ASC"
          )
          .all(fromId) as DbTodoCard[]
      ).filter((c) => c.id !== cardId);
      const idx = Math.min(Math.max(0, toIndex), all.length);
      const ordered = [...all.slice(0, idx), card, ...all.slice(idx)];
      ordered.forEach((c, i) => {
        db.prepare(
          "UPDATE todo_cards SET sort_order = ?, updated_at = datetime('now') WHERE id = ?"
        ).run(i, c.id);
      });
      return;
    }

    const fromCards = (
      db
        .prepare(
          "SELECT * FROM todo_cards WHERE column_id = ? ORDER BY sort_order ASC, id ASC"
        )
        .all(fromId) as DbTodoCard[]
    ).filter((c) => c.id !== cardId);
    const toCards = (
      db
        .prepare(
          "SELECT * FROM todo_cards WHERE column_id = ? ORDER BY sort_order ASC, id ASC"
        )
        .all(toColumnId) as DbTodoCard[]
    ).filter((c) => c.id !== cardId);
    const idx = Math.min(Math.max(0, toIndex), toCards.length);
    const newToList = [...toCards.slice(0, idx), card, ...toCards.slice(idx)];

    fromCards.forEach((c, i) => {
      db.prepare(
        "UPDATE todo_cards SET sort_order = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(i, c.id);
    });
    newToList.forEach((c, i) => {
      db.prepare(
        "UPDATE todo_cards SET column_id = ?, sort_order = ?, updated_at = datetime('now') WHERE id = ?"
      ).run(toColumnId, i, c.id);
    });
  });
  run();
}

export function upsertAppAnalytics(
  appId: string,
  data: {
    visits_30d?: number;
    conversions_30d?: number;
    revenue_proxy_30d?: number;
    notes?: string | null;
  }
): void {
  const db = getDb();
  const existing = db
    .prepare("SELECT 1 FROM app_analytics WHERE app_id = ?")
    .get(appId);
  if (!existing) {
    db.prepare(
      "INSERT INTO app_analytics (app_id, visits_30d, conversions_30d, revenue_proxy_30d, notes, updated_at) VALUES (?, 0, 0, 0, ?, datetime('now'))"
    ).run(appId, data.notes ?? null);
  }
  const sets: string[] = ["updated_at = datetime('now')"];
  const values: (number | string | null)[] = [];
  if (data.visits_30d !== undefined) {
    sets.push("visits_30d = ?");
    values.push(data.visits_30d);
  }
  if (data.conversions_30d !== undefined) {
    sets.push("conversions_30d = ?");
    values.push(data.conversions_30d);
  }
  if (data.revenue_proxy_30d !== undefined) {
    sets.push("revenue_proxy_30d = ?");
    values.push(data.revenue_proxy_30d);
  }
  if (data.notes !== undefined) {
    sets.push("notes = ?");
    values.push(data.notes);
  }
  if (values.length === 0) return;
  values.push(appId);
  db.prepare(
    `UPDATE app_analytics SET ${sets.join(", ")} WHERE app_id = ?`
  ).run(...values);
}
