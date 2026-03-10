import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { config } from "./config";

fs.mkdirSync(config.dataDir, { recursive: true });

const db = new Database(path.join(config.dataDir, "pipesecure.db"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tracked_issues (
    fingerprint  TEXT PRIMARY KEY,
    issue_number INTEGER,
    state        TEXT NOT NULL DEFAULT 'open',
    rule_id      TEXT NOT NULL,
    file_path    TEXT NOT NULL,
    title        TEXT NOT NULL,
    severity     TEXT NOT NULL,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at  TEXT
  );
`);

export interface TrackedIssue {
  fingerprint: string;
  issue_number: number | null;
  state: string;
  rule_id: string;
  file_path: string;
  title: string;
  severity: string;
  created_at: string;
  resolved_at: string | null;
}

export const issueStore = {
  getByFingerprint(fp: string): TrackedIssue | undefined {
    return db
      .prepare("SELECT * FROM tracked_issues WHERE fingerprint = ?")
      .get(fp) as TrackedIssue | undefined;
  },

  getAllOpen(): TrackedIssue[] {
    return db
      .prepare("SELECT * FROM tracked_issues WHERE state = 'open'")
      .all() as TrackedIssue[];
  },

  insert(data: {
    fingerprint: string;
    issue_number: number;
    rule_id: string;
    file_path: string;
    title: string;
    severity: string;
  }) {
    db.prepare(`
      INSERT INTO tracked_issues (fingerprint, issue_number, state, rule_id, file_path, title, severity)
      VALUES (@fingerprint, @issue_number, 'open', @rule_id, @file_path, @title, @severity)
    `).run(data);
  },

  markClosed(fingerprint: string) {
    db.prepare(
      "UPDATE tracked_issues SET state = 'closed', resolved_at = datetime('now') WHERE fingerprint = ?"
    ).run(fingerprint);
  },

  reopen(fingerprint: string, issueNumber: number) {
    db.prepare(
      "UPDATE tracked_issues SET state = 'open', resolved_at = NULL, issue_number = ? WHERE fingerprint = ?"
    ).run(issueNumber, fingerprint);
  },
};
