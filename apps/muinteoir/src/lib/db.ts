import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const DATA_DIR =
      process.env.NODE_ENV === "production"
        ? "/app/data"
        : path.join(process.cwd(), "data");

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const DB_PATH = path.join(DATA_DIR, "muinteoir.db");
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    migrate(_db);
  }
  return _db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL CHECK (mode IN ('conversation', 'lesson')),
      topic TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS lesson_progress (
      topic_id TEXT PRIMARY KEY,
      completed_at INTEGER,
      score INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0
    );
  `);
}

export function createSession(mode: "conversation" | "lesson", topic?: string): string {
  const db = getDb();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  db.prepare(
    "INSERT INTO sessions (id, mode, topic) VALUES (?, ?, ?)"
  ).run(id, mode, topic ?? null);
  return id;
}

export function getSession(id: string) {
  return getDb().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | { id: string; mode: string; topic: string | null; created_at: number }
    | undefined;
}

export function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
) {
  const db = getDb();
  db.prepare(
    "INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)"
  ).run(sessionId, role, content);
  db.prepare(
    "UPDATE sessions SET updated_at = unixepoch() WHERE id = ?"
  ).run(sessionId);
}

export function getMessages(sessionId: string) {
  return getDb()
    .prepare(
      "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC"
    )
    .all(sessionId) as { role: "user" | "assistant"; content: string }[];
}

export function recordLessonAttempt(topicId: string, score: number) {
  getDb()
    .prepare(
      `INSERT INTO lesson_progress (topic_id, score, attempts, completed_at)
       VALUES (?, ?, 1, CASE WHEN ? >= 70 THEN unixepoch() ELSE NULL END)
       ON CONFLICT(topic_id) DO UPDATE SET
         score = MAX(score, excluded.score),
         attempts = attempts + 1,
         completed_at = CASE WHEN excluded.score >= 70 THEN unixepoch() ELSE completed_at END`
    )
    .run(topicId, score, score);
}

export function getAllProgress() {
  return getDb()
    .prepare("SELECT * FROM lesson_progress")
    .all() as { topic_id: string; completed_at: number | null; score: number; attempts: number }[];
}
