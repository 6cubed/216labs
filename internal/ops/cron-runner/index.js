/**
 * Cron runner: every 5 minutes, read enabled jobs from 216labs.db,
 * run due handlers, send to Telegram, update last_run_at.
 * Exposes POST /run/:id for immediate run (admin panel). Auth: CRON_RUNNER_SECRET env
 * or same key in env_vars (216labs.db); if both empty, accepts unauthenticated POST (trust Docker network).
 * GET /telegram-env — masked proof of which Telegram-related keys exist in process env vs env_vars
 * (same auth as POST /run when a secret is configured).
 * Uses better-sqlite3 with WAL so cron_jobs.last_run_at and env_vars stay in sync
 * with admin (sql.js full-file snapshots fought the shared 216labs.db WAL mount).
 */
import { createServer } from "http";
import { Cron } from "croner";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { existsSync, mkdirSync } from "fs";
import Database from "better-sqlite3";
import * as handlers from "./handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_PATH =
  process.env.DATABASE_PATH || join(__dirname, "..", "216labs.db");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const HAPPYPATH_INTERNAL_URL =
  process.env.HAPPYPATH_INTERNAL_URL || "https://happypath.6cubed.app";
const CRON_RUNNER_SECRET = process.env.CRON_RUNNER_SECRET || "";
const RUN_SERVER_PORT = parseInt(process.env.RUN_SERVER_PORT || "3029", 10);

/** Open shared 216labs.db (WAL) — same file admin and deploy use. */
async function getDb() {
  const parent = dirname(DATABASE_PATH);
  if (parent && !existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
  const db = new Database(DATABASE_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("busy_timeout = 5000");
  return {
    exec(sql) {
      db.exec(sql);
    },
    prepare(sql) {
      return db.prepare(sql);
    },
    close() {
      db.close();
    },
  };
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
    CREATE TABLE IF NOT EXISTS edge_visitor_day (
      app_id TEXT NOT NULL,
      day_utc TEXT NOT NULL,
      visitor_hash TEXT NOT NULL,
      PRIMARY KEY (app_id, day_utc, visitor_hash)
    );
    CREATE INDEX IF NOT EXISTS idx_edge_visitor_day_app_day ON edge_visitor_day(app_id, day_utc);
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
  `);
  db.exec(`
    INSERT OR IGNORE INTO cron_jobs (id, name, description, schedule, enabled) VALUES
    ('telegram-daily-digest', 'Daily codebase digest', 'Summarise repo activity and open PRs/issues; post to Telegram.', '0 9 * * *', 0),
    ('telegram-weekly-lint', 'Weekly lint & quality report', 'Run lint/formatter checks and report findings to Telegram.', '0 9 * * 1', 0),
    ('telegram-security-summary', 'Security scan summary', 'PipeSecure/Semgrep findings summary posted to Telegram.', '0 10 * * *', 0),
    ('telegram-happypath-summary', 'Happy Path run summary', 'Last Happy Path results per app posted to Telegram.', '0 8 * * *', 0),
    ('telegram-group-hourly-reply', 'Group hourly AI reply', 'Polls Telegram updates for a configured group since last run, drafts a short reply with OpenAI, posts to that group.', '0 * * * *', 0),
    ('workforce-telegram-test', 'Workforce Telegram test', 'Hourly ping from the first digital employee bot (or main bot if registry empty). Chat: WORKFORCE_TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID.', '0 * * * *', 1),
    ('edge-visitor-rollup', 'Edge visitor rollup (Caddy logs)', 'Reads Caddy JSON access logs and stores coarse daily unique visitors per app in edge_visitor_day.', '*/15 * * * *', 1),
    ('client-error-prune', 'Prune old client error events', 'Deletes client_error_event rows older than 14 days.', '15 4 * * *', 1),
    ('revenue-env-check', 'Revenue & edge smoke', 'HTTP probes for admin + paid apps; Telegram alert only on failure. State key revenue_env_last.', '0 */4 * * *', 1),
    ('stack-health-check', 'Stack health (edge vs internal)', 'Compares public URLs vs Docker-internal probes; Telegram on failure. State key stack_health_last.', '*/15 * * * *', 1),
    ('difftinder-daily-idea', 'DiffTinder daily idea', 'Adds one speculative monorepo idea per UTC day for admin swipe review.', '0 7 * * *', 1),
    ('agitweet-autopost', 'Agitweet autopost', 'Composes one post (world RSS + 216labs prompts) and publishes to agitweet.6cubed.app.', '*/15 * * * *', 1),
    ('lead-notify', 'Lead notify (Telegram)', 'Pings Telegram when new rows appear in lead_event (landing hire form).', '*/5 * * * *', 1);
  `);
  // Belt-and-suspenders: older DBs opened before stack-health-check existed.
  db.prepare(
    `INSERT OR IGNORE INTO cron_jobs (id, name, description, schedule, enabled) VALUES (?, ?, ?, ?, 1)`
  ).run(
    "stack-health-check",
    "Stack health (edge vs internal)",
    "Compares public URLs vs Docker-internal probes; Telegram on failure. State key stack_health_last.",
    "*/15 * * * *"
  );
  ensureWorkforceCronEnabledOnce(db);
  // Fresher revenue probes (was 08:00 & 20:00 UTC only).
  db.prepare(
    `UPDATE cron_jobs SET schedule = '0 */4 * * *' WHERE id = 'revenue-env-check'`
  ).run();
  return true;
}

/** Read admin Env (216labs.db) when process env is empty — compose often omits keys that exist only in env_vars. */
function envFromDb(db, key) {
  if (!db) return "";
  try {
    const row = db.prepare("SELECT value FROM env_vars WHERE key = ?").get(key);
    if (!row) return "";
    const v = row.value ?? row.VALUE;
    if (v == null || v === "") return "";
    const s = String(v).trim();
    return s || "";
  } catch {
    return "";
  }
}

/** One-time: turn on workforce Telegram test job so it actually runs without a manual toggle. */
function ensureWorkforceCronEnabledOnce(db) {
  try {
    const row = db
      .prepare("SELECT value FROM cron_runner_state WHERE key = ?")
      .get("workforce_telegram_cron_enabled_v1");
    const flag = row?.value ?? row?.VALUE;
    if (String(flag ?? "") === "1") return;
    db.prepare("UPDATE cron_jobs SET enabled = 1 WHERE id = 'workforce-telegram-test'").run();
    db.prepare("INSERT OR REPLACE INTO cron_runner_state (key, value) VALUES (?, ?)").run(
      "workforce_telegram_cron_enabled_v1",
      "1"
    );
    console.log("[cron-runner] enabled job workforce-telegram-test (one-time bootstrap)");
  } catch (e) {
    console.warn("[cron-runner] ensureWorkforceCronEnabledOnce:", e?.message || e);
  }
}

function maskChatSuffix(s, len = 4) {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (t.length <= len) return "*".repeat(Math.min(t.length, 8));
  return `…${t.slice(-len)}`;
}

function getCronExpectedSecret(db) {
  const envSecret = (process.env.CRON_RUNNER_SECRET || "").trim();
  let dbSecret = "";
  try {
    const row = db.prepare("SELECT value FROM env_vars WHERE key = ?").get("CRON_RUNNER_SECRET");
    if (row) {
      const v = row.value ?? row.VALUE;
      if (v != null && v !== "") dbSecret = String(v).trim();
    }
  } catch {
    dbSecret = "";
  }
  return envSecret || dbSecret;
}

function cronAuthOk(db, req) {
  const expected = getCronExpectedSecret(db);
  if (!expected) return true;
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token === expected;
}

function telegramKeyPresence(db, key) {
  const pe = process.env[key];
  const proc = !!(pe && String(pe).trim());
  const dbv = envFromDb(db, key);
  const fromDb = !!dbv;
  if (key.includes("CHAT_ID")) {
    return {
      in_process_env: proc,
      in_env_vars_db: fromDb,
      process_suffix: proc ? maskChatSuffix(pe) : null,
      db_suffix: fromDb ? maskChatSuffix(dbv) : null,
    };
  }
  return {
    in_process_env: proc,
    in_env_vars_db: fromDb,
  };
}

function buildTelegramEnvReport(db) {
  const keys = ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID", "WORKFORCE_TELEGRAM_CHAT_ID"];
  const keys_detail = {};
  for (const k of keys) keys_detail[k] = telegramKeyPresence(db, k);

  const resolvedChat =
    envFromDb(db, "WORKFORCE_TELEGRAM_CHAT_ID") ||
    process.env.WORKFORCE_TELEGRAM_CHAT_ID?.trim() ||
    envFromDb(db, "TELEGRAM_CHAT_ID") ||
    TELEGRAM_CHAT_ID ||
    "";
  const resolvedMainToken =
    envFromDb(db, "TELEGRAM_BOT_TOKEN") || TELEGRAM_BOT_TOKEN || "";

  const storePath =
    process.env.WORKFORCE_STORE_PATH || "/app/workforce-data/workforce-employees.json";
  const workforce = {
    store_path: storePath,
    file_exists: existsSync(storePath),
    employee_count: 0,
    first_employee_name: null,
    first_employee_telegram_token_configured: false,
  };
  try {
    if (workforce.file_exists) {
      const raw = JSON.parse(readFileSync(storePath, "utf8"));
      const em = raw?.employees;
      if (Array.isArray(em)) {
        workforce.employee_count = em.length;
        const sorted = [...em].sort((a, b) =>
          String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
        );
        const first = sorted[0];
        if (first) {
          workforce.first_employee_name = first.name || null;
          workforce.first_employee_telegram_token_configured = !!(
            first.telegramBotToken && String(first.telegramBotToken).trim()
          );
        }
      }
    }
  } catch (err) {
    workforce.registry_read_error = err.message || String(err);
  }

  let workforce_job_enabled = null;
  try {
    const row = db.prepare("SELECT enabled FROM cron_jobs WHERE id = ?").get("workforce-telegram-test");
    if (row) {
      const en = row.enabled ?? row.ENABLED;
      workforce_job_enabled = en === 1 || en === true || String(en) === "1";
    }
  } catch {
    workforce_job_enabled = null;
  }

  return {
    ok: true,
    database_path: DATABASE_PATH,
    db_file_exists: existsSync(DATABASE_PATH),
    resolved_chat_id_suffix: maskChatSuffix(resolvedChat),
    can_send_with_main_bot_token: !!(resolvedChat && resolvedMainToken),
    workforce_telegram_test_job_enabled: workforce_job_enabled,
    workforce_ping_uses_first_employee_bot_token:
      workforce.first_employee_telegram_token_configured,
    keys: keys_detail,
    workforce_registry: workforce,
    hints: [
      "If the first employee has telegramBotToken, workforce test sends with that bot — it must be in the target chat.",
      "Chat resolution order: WORKFORCE_TELEGRAM_CHAT_ID then TELEGRAM_CHAT_ID (process env and env_vars).",
    ],
  };
}

async function sendToTelegram(text, chatIdOverride, tokenOverride, db) {
  const override =
    typeof chatIdOverride === "string" && chatIdOverride.trim()
      ? chatIdOverride.trim()
      : "";
  const chatId =
    override ||
    envFromDb(db, "WORKFORCE_TELEGRAM_CHAT_ID") ||
    process.env.WORKFORCE_TELEGRAM_CHAT_ID?.trim() ||
    envFromDb(db, "TELEGRAM_CHAT_ID") ||
    TELEGRAM_CHAT_ID ||
    "";
  const token =
    tokenOverride || envFromDb(db, "TELEGRAM_BOT_TOKEN") || TELEGRAM_BOT_TOKEN || "";
  if (!token || !chatId) {
    console.warn(
      "[cron-runner] Telegram token or chat id not set; skipping send (check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID or WORKFORCE_TELEGRAM_CHAT_ID in admin Env / env_vars)"
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
    await sendToTelegram(text, overrideChatId, sendTokenOverride, db);
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

  if (method === "GET" && url.pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "cron-runner" }));
    return;
  }

  if (method === "GET" && url.pathname === "/telegram-env") {
    const db = await getDb();
    try {
      ensureCronRunnerMigrations(db);
      if (!cronAuthOk(db, req)) {
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "Unauthorized" }));
        return;
      }
      const report = buildTelegramEnvReport(db);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(report));
    } catch (err) {
      console.error("[cron-runner] telegram-env error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          ok: false,
          error: err && err.message ? err.message : "Failed",
        })
      );
    } finally {
      db.close();
    }
    return;
  }

  if (method === "POST" && match) {
    const jobId = match[1];
    const db = await getDb();
    try {
      ensureCronRunnerMigrations(db);
      if (!cronAuthOk(db, req)) {
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
  console.log(
    "[cron-runner] HTTP on port",
    RUN_SERVER_PORT,
    "(GET /health, POST /run/:id, GET /telegram-env)"
  );
});

console.log("[cron-runner] Started; checking every 5 minutes (UTC). DB:", DATABASE_PATH);
await tick();
