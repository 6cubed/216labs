import { createHash } from "crypto";
import type Database from "better-sqlite3";

export type ClientErrorKind = "client" | "server";

export type ClientErrorInsert = {
  appId: string;
  kind: ClientErrorKind;
  message: string;
  stack?: string;
  url?: string;
};

export type ClientErrorRow = {
  id: number;
  app_id: string;
  kind: string;
  message: string;
  stack: string | null;
  url: string | null;
  fingerprint: string;
  occurred_at: string;
};

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;
const MAX_URL = 500;

export function ensureClientErrorEventsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS client_error_event (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_id TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'client',
      message TEXT NOT NULL,
      stack TEXT,
      url TEXT,
      fingerprint TEXT NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      day_utc TEXT NOT NULL DEFAULT (date('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_client_error_app_time ON client_error_event(app_id, occurred_at);
    CREATE INDEX IF NOT EXISTS idx_client_error_day ON client_error_event(day_utc, app_id);
  `);
}

export function fingerprintFor(appId: string, kind: string, message: string): string {
  const norm = `${appId}|${kind}|${message.trim().slice(0, 400)}`;
  return createHash("sha256").update(norm).digest("hex").slice(0, 16);
}

export function insertClientErrorEvent(
  db: Database.Database,
  row: ClientErrorInsert,
): number {
  const message = row.message.trim().slice(0, MAX_MESSAGE) || "(empty message)";
  const stack = row.stack?.trim().slice(0, MAX_STACK) || null;
  const url = row.url?.trim().slice(0, MAX_URL) || null;
  const kind = row.kind === "server" ? "server" : "client";
  const fp = fingerprintFor(row.appId, kind, message);
  const result = db
    .prepare(
      `INSERT INTO client_error_event (app_id, kind, message, stack, url, fingerprint, occurred_at, day_utc)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'), date('now'))`,
    )
    .run(row.appId, kind, message, stack, url, fp);
  return Number(result.lastInsertRowid);
}

/** Count rows in the last N hours (for nav badge / overview). */
/** Per-app reported error counts in the last N hours (for Applications table). */
export function countClientErrorEventsByAppSinceHours(
  db: Database.Database,
  hours: number,
): Record<string, number> {
  const rows = db
    .prepare(
      `SELECT app_id, COUNT(*) AS c FROM client_error_event
       WHERE datetime(occurred_at) >= datetime('now', ?)
       GROUP BY app_id`,
    )
    .all(`-${hours} hours`) as { app_id: string; c: number }[];
  const out: Record<string, number> = {};
  for (const r of rows) {
    if (r.app_id) out[r.app_id] = r.c;
  }
  return out;
}

export function countClientErrorEventsSinceHours(
  db: Database.Database,
  hours: number,
): number {
  const row = db
    .prepare(
      `SELECT COUNT(*) AS c FROM client_error_event
       WHERE datetime(occurred_at) >= datetime('now', ?)`,
    )
    .get(`-${hours} hours`) as { c: number };
  return row?.c ?? 0;
}

export function listRecentClientErrorEvents(
  db: Database.Database,
  limit: number,
): ClientErrorRow[] {
  return db
    .prepare(
      `SELECT id, app_id, kind, message, stack, url, fingerprint, occurred_at
       FROM client_error_event
       ORDER BY datetime(occurred_at) DESC
       LIMIT ?`,
    )
    .all(limit) as ClientErrorRow[];
}

export function pruneClientErrorEventsOlderThanDays(
  db: Database.Database,
  days: number,
): number {
  const result = db
    .prepare(
      `DELETE FROM client_error_event
       WHERE datetime(occurred_at) < datetime('now', ?)`,
    )
    .run(`-${days} days`);
  return result.changes;
}
