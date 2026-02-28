import Database from "better-sqlite3";
import { existsSync, readdirSync, readFileSync } from "fs";
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
]);

const AUTO_DISCOVERED_TAGLINE = "Auto-discovered monorepo project";
const AUTO_DISCOVERED_NOTE = "Auto-discovered. Update metadata in admin DB.";

// Ports assigned before the manifest system. Kept so that existing DB rows
// with port=0 (from pre-manifest auto-discovery) get corrected on startup.
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

  syncTopLevelProjects(db);
  backfillKnownPorts(db);
  ensureAdminAlwaysEnabled(db);
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

function upsertEnvVarsFromManifest(
  db: Database.Database,
  manifest: AppManifest
) {
  if (!manifest.env_vars?.length) return;
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

function discoverTopLevelProjects() {
  if (!existsSync(PROJECTS_ROOT)) return [];

  return readdirSync(PROJECTS_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        !entry.name.startsWith(".") &&
        !NON_PROJECT_DIRS.has(entry.name) &&
        (existsSync(join(PROJECTS_ROOT, entry.name, "Dockerfile")) ||
          existsSync(join(PROJECTS_ROOT, entry.name, "manifest.json")))
    )
    .map((entry) => entry.name);
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

function syncTopLevelProjects(db: Database.Database) {
  const discoveredDirs = discoverTopLevelProjects();
  pruneInvalidAutoDiscoveredApps(db, new Set(discoveredDirs));
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
            "Automatically discovered from top-level directories in the 216labs repo.",
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
