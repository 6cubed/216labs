/**
 * Cron runner: every 5 minutes, read enabled jobs from 216labs.db,
 * run due handlers, send to Telegram, update last_run_at.
 */
import Database from "better-sqlite3";
import { Cron } from "croner";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import * as handlers from "./handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const DATABASE_PATH =
  process.env.DATABASE_PATH || join(__dirname, "..", "216labs.db");
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || "";
const HAPPYPATH_INTERNAL_URL =
  process.env.HAPPYPATH_INTERNAL_URL || "https://happypath.6cubed.app";

const INTERVAL_MS = 5 * 60 * 1000;

function getDb() {
  return new Database(DATABASE_PATH, { readonly: false });
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

async function sendToTelegram(text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn("[cron-runner] TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set; skipping send");
    return;
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
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
  try {
    text = await fn(db, { HAPPYPATH_INTERNAL_URL });
  } catch (err) {
    console.error("[cron-runner] Handler error for", id, err);
    text = `${name}: error — ${err.message}`;
  }
  if (text && text.length > 0) {
    await sendToTelegram(text);
  }
  db.prepare("UPDATE cron_jobs SET last_run_at = datetime('now') WHERE id = ?").run(id);
}

async function tick() {
  const db = getDb();
  try {
    const tableExists = db
      .prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'cron_jobs'"
      )
      .get();
    if (!tableExists) {
      console.warn("[cron-runner] Table cron_jobs not found; run admin once to init schema.");
      return;
    }
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

console.log("[cron-runner] Started; checking every 5 minutes (UTC). DB:", DATABASE_PATH);
await tick();
