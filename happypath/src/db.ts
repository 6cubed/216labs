import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { config, LABS_DB_PATH } from "./config.js";

mkdirSync(config.dataDir, { recursive: true });

const dbPath = join(config.dataDir, "happypath.db");
const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS test_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    total       INTEGER,
    passed      INTEGER,
    failed      INTEGER
  );

  CREATE TABLE IF NOT EXISTS test_results (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL REFERENCES test_runs(id),
    app_id      TEXT NOT NULL,
    base_url    TEXT NOT NULL,
    passed      INTEGER NOT NULL,
    message     TEXT,
    duration_ms INTEGER,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_test_results_run_id ON test_results(run_id);
  CREATE INDEX IF NOT EXISTS idx_test_results_app_id ON test_results(app_id);
`);

export interface TestResultRow {
  id: number;
  run_id: number;
  app_id: string;
  base_url: string;
  passed: number;
  message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export interface TestRunRow {
  id: number;
  started_at: string;
  finished_at: string | null;
  total: number | null;
  passed: number | null;
  failed: number | null;
}

export const testRunStore = {
  start(): number {
    const result = db.prepare("INSERT INTO test_runs (started_at) VALUES (datetime('now'))").run();
    return result.lastInsertRowid as number;
  },

  finish(runId: number, total: number, passed: number, failed: number): void {
    db.prepare(
      "UPDATE test_runs SET finished_at = datetime('now'), total = ?, passed = ?, failed = ? WHERE id = ?"
    ).run(total, passed, failed, runId);
  },

  insertResult(data: {
    runId: number;
    appId: string;
    baseUrl: string;
    passed: boolean;
    message?: string;
    durationMs?: number;
  }): void {
    db.prepare(
      `INSERT INTO test_results (run_id, app_id, base_url, passed, message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      data.runId,
      data.appId,
      data.baseUrl,
      data.passed ? 1 : 0,
      data.message ?? null,
      data.durationMs ?? null
    );
  },

  latestRun(): TestRunRow | undefined {
    return db.prepare("SELECT * FROM test_runs ORDER BY id DESC LIMIT 1").get() as
      | TestRunRow
      | undefined;
  },

  resultsForRun(runId: number): TestResultRow[] {
    return db.prepare("SELECT * FROM test_results WHERE run_id = ? ORDER BY app_id").all(runId) as TestResultRow[];
  },

  latestResultsByApp(): Map<string, { passed: number; message: string | null; created_at: string }> {
    const rows = db
      .prepare(
        `SELECT app_id, passed, message, created_at FROM test_results
         WHERE id IN (SELECT MAX(id) FROM test_results GROUP BY app_id)`
      )
      .all() as Array<{ app_id: string; passed: number; message: string | null; created_at: string }>;
    const map = new Map<string, { passed: number; message: string | null; created_at: string }>();
    for (const r of rows) {
      map.set(r.app_id, { passed: r.passed, message: r.message, created_at: r.created_at });
    }
    return map;
  },
};

/** Read-only access to 216labs admin DB to get enabled apps. */
export function getEnabledAppIds(): string[] {
  if (!existsSync(LABS_DB_PATH)) {
    console.warn("[happypath] No 216labs.db found at", LABS_DB_PATH, "- using default app list");
    return [
      "ramblingradio",
      "stroll",
      "onefit",
      "oneroom",
      "paperframe",
      "hivefind",
      "agimemes",
      "pocket",
    ];
  }
  try {
    const labsDb = new Database(LABS_DB_PATH, { readonly: true });
    try {
      const rows = labsDb
        .prepare(
          "SELECT id FROM apps WHERE deploy_enabled = 1 AND id != 'admin' ORDER BY port"
        )
        .all() as Array<{ id: string }>;
      const ids = rows.map((r) => r.id);
      if (ids.length > 0) return ids;
    } finally {
      labsDb.close();
    }
  } catch (e) {
    console.warn("[happypath] Could not read 216labs.db:", (e as Error).message);
  }
  return [
    "ramblingradio",
    "stroll",
    "onefit",
    "oneroom",
    "paperframe",
    "hivefind",
    "agimemes",
    "pocket",
    "happypath",
  ];
}

export function getStatusData(): {
  lastRun: TestRunRow | undefined;
  resultsByApp: Map<string, { passed: number; message: string | null; created_at: string }>;
  enabledApps: string[];
} {
  const lastRun = testRunStore.latestRun();
  const resultsByApp = testRunStore.latestResultsByApp();
  const enabledApps = getEnabledAppIds();
  return { lastRun, resultsByApp, enabledApps };
}
