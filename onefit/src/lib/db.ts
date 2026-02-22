import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = path.join(process.cwd(), ".data", "onefit.db");

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
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      outfit_title TEXT NOT NULL,
      outfit_json TEXT NOT NULL,
      vote TEXT NOT NULL CHECK(vote IN ('up', 'down')),
      occasion TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS daily_looks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      outfit_json TEXT NOT NULL,
      style_profile TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);

  return _db;
}

export interface DbUser {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
}

export interface DbFeedback {
  id: number;
  user_id: number;
  outfit_title: string;
  outfit_json: string;
  vote: "up" | "down";
  occasion: string | null;
  created_at: string;
}

export interface DbDailyLook {
  id: number;
  user_id: number;
  date: string;
  outfit_json: string;
  style_profile: string | null;
  created_at: string;
}

export function createUser(email: string, name: string, passwordHash: string): DbUser {
  const db = getDb();
  const stmt = db.prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)");
  const result = stmt.run(email.toLowerCase().trim(), name.trim(), passwordHash);
  return db.prepare("SELECT * FROM users WHERE id = ?").get(result.lastInsertRowid) as DbUser;
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
  outfitTitle: string,
  outfitJson: string,
  vote: "up" | "down",
  occasion?: string
) {
  getDb()
    .prepare("INSERT INTO feedback (user_id, outfit_title, outfit_json, vote, occasion) VALUES (?, ?, ?, ?, ?)")
    .run(userId, outfitTitle, outfitJson, vote, occasion ?? null);
}

export function getUserFeedback(userId: number): DbFeedback[] {
  return getDb()
    .prepare("SELECT * FROM feedback WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as DbFeedback[];
}

export function getDailyLook(userId: number, date: string): DbDailyLook | undefined {
  return getDb()
    .prepare("SELECT * FROM daily_looks WHERE user_id = ? AND date = ?")
    .get(userId, date) as DbDailyLook | undefined;
}

export function saveDailyLook(userId: number, date: string, outfitJson: string, styleProfile: string) {
  const db = getDb();
  const existing = getDailyLook(userId, date);
  if (existing) {
    db.prepare("UPDATE daily_looks SET outfit_json = ?, style_profile = ? WHERE id = ?")
      .run(outfitJson, styleProfile, existing.id);
  } else {
    db.prepare("INSERT INTO daily_looks (user_id, date, outfit_json, style_profile) VALUES (?, ?, ?, ?)")
      .run(userId, date, outfitJson, styleProfile);
  }
}
