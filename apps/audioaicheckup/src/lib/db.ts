import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), ".data");
const DB_PATH = join(DATA_DIR, "audioaicheckup.db");
const AUDIO_DIR = join(DATA_DIR, "audio");

export function getAudioDir(): string {
  if (!existsSync(AUDIO_DIR)) mkdirSync(AUDIO_DIR, { recursive: true });
  return AUDIO_DIR;
}

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.pragma("foreign_keys = ON");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      audio_filename TEXT NOT NULL,
      audio_size_bytes INTEGER NOT NULL,
      question TEXT NOT NULL,
      expected_answer TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      submission_id INTEGER NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
      model_id TEXT NOT NULL,
      model_name TEXT NOT NULL,
      provider TEXT NOT NULL,
      raw_answer TEXT,
      is_correct INTEGER NOT NULL DEFAULT 0,
      latency_ms INTEGER,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_evaluations_submission ON evaluations(submission_id);
    CREATE INDEX IF NOT EXISTS idx_evaluations_model ON evaluations(model_id);
  `);
}

export interface DbSubmission {
  id: number;
  audio_filename: string;
  audio_size_bytes: number;
  question: string;
  expected_answer: string;
  created_at: string;
}

export interface DbEvaluation {
  id: number;
  submission_id: number;
  model_id: string;
  model_name: string;
  provider: string;
  raw_answer: string | null;
  is_correct: number;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
}

export function insertSubmission(data: {
  audio_filename: string;
  audio_size_bytes: number;
  question: string;
  expected_answer: string;
}): number {
  const result = getDb()
    .prepare(
      `INSERT INTO submissions (audio_filename, audio_size_bytes, question, expected_answer)
       VALUES (@audio_filename, @audio_size_bytes, @question, @expected_answer)`
    )
    .run(data);
  return result.lastInsertRowid as number;
}

export function insertEvaluation(data: {
  submission_id: number;
  model_id: string;
  model_name: string;
  provider: string;
  raw_answer: string | null;
  is_correct: number;
  latency_ms: number | null;
  error: string | null;
}): void {
  getDb()
    .prepare(
      `INSERT INTO evaluations (submission_id, model_id, model_name, provider, raw_answer, is_correct, latency_ms, error)
       VALUES (@submission_id, @model_id, @model_name, @provider, @raw_answer, @is_correct, @latency_ms, @error)`
    )
    .run(data);
}

export interface LeaderboardRow {
  model_id: string;
  model_name: string;
  provider: string;
  total: number;
  correct: number;
  accuracy: number;
  avg_latency_ms: number | null;
}

export function getLeaderboard(): LeaderboardRow[] {
  return getDb()
    .prepare(
      `SELECT
        model_id,
        model_name,
        provider,
        COUNT(*) as total,
        SUM(is_correct) as correct,
        ROUND(100.0 * SUM(is_correct) / COUNT(*), 1) as accuracy,
        ROUND(AVG(latency_ms)) as avg_latency_ms
       FROM evaluations
       WHERE error IS NULL
       GROUP BY model_id
       ORDER BY accuracy DESC, total DESC`
    )
    .all() as LeaderboardRow[];
}

export interface SubmissionWithEvaluations extends DbSubmission {
  evaluations: DbEvaluation[];
}

export function getRecentSubmissions(limit = 20): SubmissionWithEvaluations[] {
  const db = getDb();
  const submissions = db
    .prepare(
      `SELECT * FROM submissions ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as DbSubmission[];

  return submissions.map((sub) => ({
    ...sub,
    evaluations: db
      .prepare(`SELECT * FROM evaluations WHERE submission_id = ? ORDER BY model_name`)
      .all(sub.id) as DbEvaluation[],
  }));
}
