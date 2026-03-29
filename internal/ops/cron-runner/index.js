/**
 * Cron runner: every 5 minutes, read enabled jobs from 216labs.db,
 * run due handlers, send to Telegram, update last_run_at.
 * Exposes POST /run/:id for immediate run (admin panel). Auth: CRON_RUNNER_SECRET env
 * or same key in env_vars (216labs.db); if both empty, accepts unauthenticated POST (trust Docker network).
 * Uses sql.js (WASM) so there are no native deps — runs on any platform.
 */
import { createRequire } from "module";
import { createServer } from "http";
import { Cron } from "croner";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { readFileSync, writeFileSync, existsSync } from "fs";
import * as handlers from "./handlers.js";

const require = createRequire(import.meta.url);
const initSqlJs = require("sql.js");

const __dirname = dirname(fileURLToPath(import.meta.url));

// sql.js in Node: point to the bundled wasm so it loads in Docker
const wasmPath = join(__dirname, "node_modules", "sql.js", "dist", "sql-wasm.wasm");

const DATABASE_PATH =
  process.env.DATABASE_PATH || join(__dirname, "..", "216labs.db");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const HAPPYPATH_INTERNAL_URL =
  process.env.HAPPYPATH_INTERNAL_URL || "https://happypath.6cubed.app";
const CRON_RUNNER_SECRET = process.env.CRON_RUNNER_SECRET || "";
const RUN_SERVER_PORT = parseInt(process.env.RUN_SERVER_PORT || "3029", 10);

let SQL = null;

async function getSql() {
  if (!SQL) {
    const wasmBinary = existsSync(wasmPath) ? readFileSync(wasmPath) : undefined;
    SQL = await initSqlJs(wasmBinary ? { wasmBinary } : {});
  }
  return SQL;
}

/** Row arrays to objects using column names */
function rowsToObjects(columns, values) {
  return values.map((row) => {
    const o = {};
    columns.forEach((col, i) => (o[col] = row[i]));
    return o;
  });
}

/**
 * Open DB from file; returns a wrapper that matches better-sqlite3-style
 * prepare().get() / .all() / .run() and close() that persists when dirty.
 */
async function getDb() {
  const Sql = await getSql();
  const buf = existsSync(DATABASE_PATH)
    ? readFileSync(DATABASE_PATH)
    : new Uint8Array(0);
  const db = buf.length ? new Sql.Database(buf) : new Sql.Database();
  let dirty = false;

  const wrapper = {
    exec(sql) {
      db.run(sql);
      dirty = true;
    },
    prepare(sql) {
      return {
        get(...params) {
          if (params.length === 0) {
            const result = db.exec(sql);
            if (!result.length || !result[0].values.length) return undefined;
            const { columns, values } = result[0];
            return rowsToObjects(columns, [values[0]])[0];
          }
          const stmt = db.prepare(sql);
          try {
            stmt.bind(params);
            if (!stmt.step()) return undefined;
            return stmt.getAsObject();
          } finally {
            stmt.free();
          }
        },
        all(...params) {
          if (params.length === 0) {
            const result = db.exec(sql);
            if (!result.length) return [];
            const { columns, values } = result[0];
            return rowsToObjects(columns, values);
          }
          const stmt = db.prepare(sql);
          const rows = [];
          try {
            stmt.bind(params);
            while (stmt.step()) rows.push(stmt.getAsObject());
            return rows;
          } finally {
            stmt.free();
          }
        },
        run(...params) {
          db.run(sql, params);
          dirty = true;
        },
      };
    },
    close() {
      if (dirty) {
        const data = db.export();
        writeFileSync(DATABASE_PATH, Buffer.from(data));
      }
      db.close();
    },
  };
  return wrapper;
}

/**
 * Check if job is due in the current 5-minute window (we run at :00, :05, :10, ...).
 * nextRun(just before window) should fall inside this window.
 */
function isDue(schedule, date) {
  try {
    const t = date.getTime();
    const windowStart = new Date(Math.floor(t / (5 * 60 * 1000)) * (5 * 60 * 1000));
    const windowEnd = new Date(windowStart.getTime() + 5 * 60 * 1000);
    const cron = new Cron(schedule, { timezone: "UTC" });
    const next = cron.nextRun(new Date(windowStart.getTime() - 1));
    if (!next) return false;
    const nextTime = next.getTime();
    return nextTime >= windowStart.getTime() && nextTime < windowEnd.getTime();
  } catch {
    return false;
  }
}

/**
 * Read CRON_RUNNER_SECRET from env_vars (same as admin). sql.js DB must have env_vars table.
 */
function readCronSecretFromDb(db) {
  try {
    const row = db
      .prepare("SELECT value FROM env_vars WHERE key = ?")
      .get("CRON_RUNNER_SECRET");
    if (!row || row.value === undefined || row.value === null) return "";
    return String(row.value).trim();
  } catch {
    return "";
  }
}

/**
 * Idempotent schema: create missing tables (same DDL as admin) and seed job rows.
 * Cron-runner may open 216labs.db before admin has initialized it — do not require admin first.
 */
function ensureCronRunnerMigrations(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS env_vars (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      is_secret INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT
    );
    CREATE TABLE IF NOT EXISTS cron_jobs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      schedule TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      last_run_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS cron_runner_state (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.exec(`
    INSERT OR IGNORE INTO cron_jobs (id, name, description, schedule, enabled) VALUES
    ('telegram-daily-digest', 'Daily codebase digest', 'Summarise repo activity and open PRs/issues; post to Telegram.', '0 9 * * *', 0),
    ('telegram-weekly-lint', 'Weekly lint & quality report', 'Run lint/formatter checks and report findings to Telegram.', '0 9 * * 1', 0),
    ('telegram-security-summary', 'Security scan summary', 'PipeSecure/Semgrep findings summary posted to Telegram.', '0 10 * * *', 0),
    ('telegram-happypath-summary', 'Happy Path run summary', 'Last Happy Path results per app posted to Telegram.', '0 8 * * *', 0),
    ('telegram-group-hourly-reply', 'Group hourly AI reply', 'Polls Telegram updates for a configured group since last run, drafts a short reply with OpenAI, posts to that group.', '0 * * * *', 0),
    ('workforce-telegram-test', 'Workforce Telegram test', 'Sends a short test message from the first digital employee (Workforce) to WORKFORCE_TELEGRAM_CHAT_ID.', '0 * * * *', 0);
  `);
  return true;
}

async function sendToTelegram(text, chatIdOverride, tokenOverride) {
  const chatId = chatIdOverride || TELEGRAM_CHAT_ID;
  const token = tokenOverride || TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) {
    console.warn(
      "[cron-runner] Telegram token or chat id not set; skipping send"
    );
    return;
  }
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    console.error("[cron-runner] Telegram send failed:", res.status, body);
  }
}

async function runJob(db, job) {
  const { id, name, schedule } = job;
  const handler = handlers.HANDLERS[id];
  const fn = handler || (async () => `Unknown job: ${id}`);
  let text;
  /** @type {string|undefined} */
  let overrideChatId;
  /** @type {string|undefined} */
  let sendTokenOverride;
  try {
    const out = await fn(db, { HAPPYPATH_INTERNAL_URL });
    if (out && typeof out === "object" && "text" in out) {
      text = out.text;
      overrideChatId = out.chatId;
      sendTokenOverride = out.sendToken;
    } else {
      text = out;
    }
  } catch (err) {
    console.error("[cron-runner] Handler error for", id, err);
    text = `${name}: error — ${err.message}`;
  }
  if (text && text.length > 0) {
    await sendToTelegram(text, overrideChatId, sendTokenOverride);
  }
  db.prepare("UPDATE cron_jobs SET last_run_at = datetime('now') WHERE id = ?").run(id);
}

async function tick() {
  const db = await getDb();
  try {
    ensureCronRunnerMigrations(db);
    const rows = db
      .prepare("SELECT id, name, schedule FROM cron_jobs WHERE enabled = 1")
      .all();
    const now = new Date();
    for (const job of rows) {
      if (isDue(job.schedule, now)) {
        await runJob(db, job);
      }
    }
  } finally {
    db.close();
  }
}

// Run every 5 minutes at :00, :05, :10, ...
new Cron("*/5 * * * *", { timezone: "UTC" }, async () => {
  await tick();
});

// HTTP server for "Run now" from admin (POST /run/:id). Secret: env CRON_RUNNER_SECRET or env_vars in DB.
createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${RUN_SERVER_PORT}`);
  const match = url.pathname.match(/^\/run\/([a-z0-9-]+)$/);
  const method = (req.method || "").toUpperCase();

  if (method === "POST" && match) {
    const jobId = match[1];
    const db = await getDb();
    try {
      ensureCronRunnerMigrations(db);
      const envSecret = (process.env.CRON_RUNNER_SECRET || "").trim();
      const dbSecret = readCronSecretFromDb(db);
      const expected = envSecret || dbSecret;
      const auth = req.headers.authorization;
      const token = auth && auth.startsWith("Bearer ") ? auth.slice(7) : "";
      if (expected && token !== expected) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return;
      }
      const job = db
        .prepare("SELECT id, name, schedule FROM cron_jobs WHERE id = ?")
        .get(jobId);
      if (!job) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Job not found" }));
        return;
      }
      await runJob(db, job);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, job: jobId }));
    } catch (err) {
      console.error("[cron-runner] Run now error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: err && err.message ? err.message : "Run failed",
        })
      );
    } finally {
      db.close();
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
}).listen(RUN_SERVER_PORT, "0.0.0.0", () => {
  console.log("[cron-runner] Run-now server on port", RUN_SERVER_PORT);
});

console.log("[cron-runner] Started; checking every 5 minutes (UTC). DB:", DATABASE_PATH);
await tick();
