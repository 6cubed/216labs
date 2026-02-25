import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dbPath =
  process.env.ZDGAME_DB_PATH ||
  path.join(process.cwd(), "data", "zdgame.db");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    _db = new Database(dbPath);
    _db.pragma("journal_mode = WAL");
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT NOT NULL,
      interested_in TEXT NOT NULL,
      occupation TEXT,
      neighborhood TEXT,
      bio TEXT NOT NULL,
      three_things TEXT NOT NULL,
      perfect_date TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      participant1_id INTEGER NOT NULL REFERENCES participants(id),
      participant2_id INTEGER NOT NULL REFERENCES participants(id),
      ai_reasoning TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

export type Participant = {
  id: number;
  name: string;
  age: number;
  gender: string;
  interested_in: string;
  occupation: string | null;
  neighborhood: string | null;
  bio: string;
  three_things: string;
  perfect_date: string;
  email: string;
  created_at: string;
};

export type Match = {
  id: number;
  participant1_id: number;
  participant2_id: number;
  ai_reasoning: string | null;
  created_at: string;
};

export function insertParticipant(
  data: Omit<Participant, "id" | "created_at">
): Participant {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO participants (name, age, gender, interested_in, occupation, neighborhood, bio, three_things, perfect_date, email)
    VALUES (@name, @age, @gender, @interested_in, @occupation, @neighborhood, @bio, @three_things, @perfect_date, @email)
  `);
  const result = stmt.run(data);
  return db
    .prepare("SELECT * FROM participants WHERE id = ?")
    .get(result.lastInsertRowid) as Participant;
}

export function getAllParticipants(): Participant[] {
  return getDb()
    .prepare("SELECT * FROM participants ORDER BY created_at DESC")
    .all() as Participant[];
}

export function getParticipantCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM participants")
    .get() as { count: number };
  return row.count;
}

export function insertMatch(
  participant1_id: number,
  participant2_id: number,
  ai_reasoning: string
): Match {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO matches (participant1_id, participant2_id, ai_reasoning)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(participant1_id, participant2_id, ai_reasoning);
  return db
    .prepare("SELECT * FROM matches WHERE id = ?")
    .get(result.lastInsertRowid) as Match;
}

export function getAllMatches(): Match[] {
  return getDb()
    .prepare("SELECT * FROM matches ORDER BY created_at DESC")
    .all() as Match[];
}

export function getMatchCount(): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) as count FROM matches")
    .get() as { count: number };
  return row.count;
}
