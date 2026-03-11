import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), ".data", "oneroom.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  _db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email_opt_in INTEGER DEFAULT 0,
      country TEXT DEFAULT 'US',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      scheme_title TEXT NOT NULL,
      scheme_json TEXT NOT NULL,
      vote TEXT NOT NULL CHECK(vote IN ('up', 'down')),
      room_goal TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_refreshes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      scheme_json TEXT NOT NULL,
      design_profile TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  // Migrations for existing databases
  try { _db.exec("ALTER TABLE users ADD COLUMN email_opt_in INTEGER DEFAULT 0"); } catch {}
  try { _db.exec("ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'US'"); } catch {}

  return _db;
}

export interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  email_opt_in: number;
  country: string;
  created_at: string;
}

export interface DbFeedback {
  id: number;
  user_id: number;
  scheme_title: string;
  scheme_json: string;
  vote: "up" | "down";
  room_goal: string | null;
  created_at: string;
}

export interface DbDailyRefresh {
  id: number;
  user_id: number;
  date: string;
  scheme_json: string;
  design_profile: string | null;
  created_at: string;
}

export function createUser(
  email: string,
  name: string,
  passwordHash: string,
  emailOptIn = false,
  country = "US"
): DbUser {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO users (email, name, password_hash, email_opt_in, country) VALUES (?, ?, ?, ?, ?)"
  );
  const result = stmt.run(
    email.toLowerCase().trim(),
    name.trim(),
    passwordHash,
    emailOptIn ? 1 : 0,
    country
  );
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as DbUser;
}

export function updateUserPrefs(
  userId: number,
  emailOptIn: boolean,
  country: string
): void {
  getDb()
    .prepare("UPDATE users SET email_opt_in = ?, country = ? WHERE id = ?")
    .run(emailOptIn ? 1 : 0, country, userId);
}

export function getEmailOptInUsers(): DbUser[] {
  return getDb()
    .prepare("SELECT * FROM users WHERE email_opt_in = 1")
    .all() as DbUser[];
}

export function getUserByEmail(email: string): DbUser | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.toLowerCase().trim()) as DbUser | undefined;
}

export function getUserById(id: number): DbUser | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as DbUser | undefined;
}

export function saveFeedback(
  userId: number,
  schemeTitle: string,
  schemeJson: string,
  vote: "up" | "down",
  roomGoal?: string
) {
  getDb()
    .prepare("INSERT INTO feedback (user_id, scheme_title, scheme_json, vote, room_goal) VALUES (?, ?, ?, ?, ?)")
    .run(userId, schemeTitle, schemeJson, vote, roomGoal ?? null);
}

export function getUserFeedback(userId: number): DbFeedback[] {
  return getDb()
    .prepare("SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as DbFeedback[];
}

export function getDailyRefresh(userId: number, date: string): DbDailyRefresh | undefined {
  return getDb()
    .prepare("SELECT * FROM daily_refreshes WHERE user_id = ? AND date = ?")
    .get(userId, date) as DbDailyRefresh | undefined;
}

export function saveDailyRefresh(
  userId: number,
  date: string,
  schemeJson: string,
  designProfile: string
) {
  const db = getDb();
  const existing = getDailyRefresh(userId, date);
  if (existing) {
    db.prepare("UPDATE daily_refreshes SET scheme_json = ?, design_profile = ? WHERE id = ?")
      .run(schemeJson, designProfile, existing.id);
  } else {
    db.prepare(
      "INSERT INTO daily_refreshes (user_id, date, scheme_json, design_profile) VALUES (?, ?, ?, ?)"
    ).run(userId, date, schemeJson, designProfile);
  }
}
