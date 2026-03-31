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

  CREATE TABLE IF NOT EXISTS scan_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at  TEXT NOT NULL DEFAULT (datetime('now')),
    finished_at TEXT,
    findings    INTEGER,
    opened      INTEGER,
    closed      INTEGER
  );
`);

const cols = db.prepare("PRAGMA table_info(tracked_issues)").all() as { name: string }[];
if (!cols.some((c) => c.name === "github_repo")) {
  db.exec(
    `ALTER TABLE tracked_issues ADD COLUMN github_repo TEXT NOT NULL DEFAULT '6cubed/216labs'`
  );
}

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
  github_repo: string;
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

  getAllOpenForRepo(repoFullName: string): TrackedIssue[] {
    return db
      .prepare("SELECT * FROM tracked_issues WHERE state = 'open' AND github_repo = ?")
      .all(repoFullName) as TrackedIssue[];
  },

  insert(data: {
    fingerprint: string;
    issue_number: number;
    rule_id: string;
    file_path: string;
    title: string;
    severity: string;
    github_repo: string;
  }) {
    db.prepare(`
      INSERT INTO tracked_issues (fingerprint, issue_number, state, rule_id, file_path, title, severity, github_repo)
      VALUES (@fingerprint, @issue_number, 'open', @rule_id, @file_path, @title, @severity, @github_repo)
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

export const scanLog = {
  start(): number {
    const result = db
      .prepare("INSERT INTO scan_log (started_at) VALUES (datetime('now'))")
      .run();
    return result.lastInsertRowid as number;
  },

  finish(id: number, findings: number, opened: number, closed: number) {
    db.prepare(
      "UPDATE scan_log SET finished_at = datetime('now'), findings = ?, opened = ?, closed = ? WHERE id = ?"
    ).run(findings, opened, closed, id);
  },

  latest() {
    return db
      .prepare("SELECT * FROM scan_log ORDER BY id DESC LIMIT 1")
      .get() as { started_at: string; finished_at: string | null; findings: number | null; opened: number | null; closed: number | null } | undefined;
  },
};

export function getStatusData() {
  const open = issueStore.getAllOpen();
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const issue of open) {
    const s = issue.severity as keyof typeof bySeverity;
    if (s in bySeverity) bySeverity[s]++;
  }
  return {
    openIssues: open,
    bySeverity,
    lastScan: scanLog.latest(),
  };
}
