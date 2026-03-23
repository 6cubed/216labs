import Database from "better-sqlite3";
import { mkdirSync } from "fs";
import { dirname, join } from "path";

const DB_PATH =
  process.env.CALIBRATEDAI_DB_PATH ||
  join(process.cwd(), "data", "calibratedai.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      question TEXT NOT NULL,
      description TEXT DEFAULT '',
      market_probability REAL,
      outcome INTEGER,
      is_resolved INTEGER DEFAULT 0,
      volume REAL DEFAULT 0,
      fetched_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS model_estimates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      probability REAL NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(event_id, model_id),
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_estimates_event ON model_estimates(event_id);
    CREATE INDEX IF NOT EXISTS idx_estimates_model ON model_estimates(model_id);
  `);
}

export interface DbEvent {
  id: string;
  question: string;
  description: string;
  market_probability: number | null;
  outcome: number | null;
  is_resolved: number;
  volume: number;
  fetched_at: string;
}

export interface DbEstimate {
  id: number;
  event_id: string;
  model_id: string;
  probability: number;
  created_at: string;
}

export function upsertEvent(event: {
  id: string;
  question: string;
  description: string;
  marketProbability: number | null;
  outcome: number | null;
  isResolved: boolean;
  volume: number;
}): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO events (id, question, description, market_probability, outcome, is_resolved, volume)
    VALUES (@id, @question, @description, @marketProbability, @outcome, @isResolved, @volume)
    ON CONFLICT(id) DO UPDATE SET
      question = excluded.question,
      description = excluded.description,
      market_probability = excluded.market_probability,
      outcome = excluded.outcome,
      is_resolved = excluded.is_resolved,
      volume = excluded.volume
  `).run({
    id: event.id,
    question: event.question,
    description: event.description,
    marketProbability: event.marketProbability,
    outcome: event.outcome,
    isResolved: event.isResolved ? 1 : 0,
    volume: event.volume,
  });
}

export function upsertEstimate(
  eventId: string,
  modelId: string,
  probability: number
): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO model_estimates (event_id, model_id, probability)
    VALUES (?, ?, ?)
    ON CONFLICT(event_id, model_id) DO UPDATE SET probability = excluded.probability
  `).run(eventId, modelId, probability);
}

export function hasEstimate(eventId: string, modelId: string): boolean {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT 1 FROM model_estimates WHERE event_id = ? AND model_id = ?"
    )
    .get(eventId, modelId);
  return !!row;
}

export function getEvent(id: string): DbEvent | undefined {
  const db = getDb();
  return db
    .prepare("SELECT * FROM events WHERE id = ?")
    .get(id) as DbEvent | undefined;
}

export function getEvents(limit = 50): DbEvent[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM events ORDER BY is_resolved DESC, volume DESC LIMIT ?"
    )
    .all(limit) as DbEvent[];
}

export function getEstimatesForModel(modelId: string): Array<{
  event_id: string;
  probability: number;
  outcome: number;
}> {
  const db = getDb();
  return db
    .prepare(`
      SELECT me.event_id, me.probability, e.outcome
      FROM model_estimates me
      JOIN events e ON e.id = me.event_id
      WHERE me.model_id = ?
        AND e.is_resolved = 1
        AND e.outcome IS NOT NULL
    `)
    .all(modelId) as Array<{
    event_id: string;
    probability: number;
    outcome: number;
  }>;
}

export function getEstimatesForEvent(eventId: string): DbEstimate[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM model_estimates WHERE event_id = ? ORDER BY model_id"
    )
    .all(eventId) as DbEstimate[];
}

export function getStats(): {
  totalEvents: number;
  resolvedEvents: number;
  totalEstimates: number;
  lastFetched: string | null;
} {
  const db = getDb();
  const totalEvents = (
    db.prepare("SELECT COUNT(*) as c FROM events").get() as { c: number }
  ).c;
  const resolvedEvents = (
    db
      .prepare("SELECT COUNT(*) as c FROM events WHERE is_resolved = 1")
      .get() as { c: number }
  ).c;
  const totalEstimates = (
    db
      .prepare("SELECT COUNT(*) as c FROM model_estimates")
      .get() as { c: number }
  ).c;
  const lastFetched = (
    db.prepare("SELECT MAX(fetched_at) as d FROM events").get() as {
      d: string | null;
    }
  ).d;
  return { totalEvents, resolvedEvents, totalEstimates, lastFetched };
}
