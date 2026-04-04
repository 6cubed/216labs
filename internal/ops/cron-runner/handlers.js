/**
 * Job handlers: each returns a string (message to send to Telegram) or
 * { text, chatId?, sendToken? } to target a different chat and/or bot token.
 * opts: { HAPPYPATH_INTERNAL_URL }
 */

import { createHash } from "crypto";
import { existsSync, openSync, closeSync, readSync, readFileSync, statSync } from "fs";

const STATE_KEY_LAST_UPDATE = "telegram-group-hourly:last_update_id";
const TG_API = "https://api.telegram.org";

function getCronState(db, key) {
  const row = db.prepare("SELECT value FROM cron_runner_state WHERE key = ?").get(key);
  return row ? row.value : null;
}

function setCronState(db, key, value) {
  db.prepare("INSERT OR REPLACE INTO cron_runner_state (key, value) VALUES (?, ?)").run(
    key,
    value
  );
}

/** Admin Env (216labs.db env_vars); compose may not pass every key into the container. */
function getEnvVar(db, key) {
  try {
    const row = db.prepare("SELECT value FROM env_vars WHERE key = ?").get(key);
    const v = row?.value;
    return typeof v === "string" && v.trim() ? v.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Drain getUpdates for a single chat; advances Telegram offset.
 */
async function collectGroupMessages(token, chatId, startOffset) {
  let offset = Math.max(1, parseInt(String(startOffset || "1"), 10) || 1);
  const lines = [];
  let maxSeen = offset - 1;

  for (let batch = 0; batch < 25; batch++) {
    const url = `${TG_API}/bot${token}/getUpdates?offset=${offset}&limit=100&timeout=0`;
    const res = await fetch(url);
    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || "getUpdates failed");
    }
    const updates = data.result || [];
    if (updates.length === 0) break;

    for (const u of updates) {
      maxSeen = Math.max(maxSeen, u.update_id);
      const msg = u.message || u.edited_message || u.channel_post;
      if (!msg?.chat) continue;
      if (String(msg.chat.id) !== String(chatId)) continue;
      const text = msg.text || msg.caption;
      if (!text || !String(text).trim()) continue;
      const from =
        msg.from?.username ||
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        "user";
      lines.push(`${from}: ${String(text).trim()}`);
    }
    offset = maxSeen + 1;
  }

  return { lines, nextOffset: maxSeen + 1 };
}

async function openaiReply(apiKey, model, transcript) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful group participant. Given recent messages from the last hour, write one concise reply (max 900 characters). Be warm and useful; if there was no real conversation, say you are here if anyone needs anything. No markdown unless the group uses it.",
        },
        {
          role: "user",
          content:
            transcript ||
            "(No new text messages in this window — still send a brief hourly check-in.)",
        },
      ],
      max_tokens: 450,
      temperature: 0.65,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const t = data.choices?.[0]?.message?.content;
  return (t && String(t).trim()) || "(empty model response)";
}

export async function telegramDailyDigest(db, _opts) {
  const total = db.prepare("SELECT COUNT(*) as n FROM apps").get().n;
  const enabled = db
    .prepare("SELECT COUNT(*) as n FROM apps WHERE deploy_enabled = 1")
    .get().n;
  const recent = db
    .prepare(
      "SELECT id, last_deployed_at FROM apps WHERE deploy_enabled = 1 AND last_deployed_at IS NOT NULL ORDER BY last_deployed_at DESC LIMIT 5"
    )
    .all();
  const lines = [
    `216labs daily — ${total} apps, ${enabled} deployed.`,
    "",
    "Last deploys:",
    ...recent.map((r) => `  ${r.id}: ${r.last_deployed_at || "—"}`),
  ];
  return lines.join("\n");
}

export async function telegramHappypathSummary(_db, opts) {
  const base = opts.HAPPYPATH_INTERNAL_URL.replace(/\/$/, "");
  const url = `${base}/api/status`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return `Happy Path: status unavailable (${res.status}). See ${base}`;
    const data = await res.json();
    const { lastRun, resultsByApp, enabledApps } = data;
    if (!lastRun)
      return `Happy Path: no run yet. See ${base}`;
    const total = lastRun.total ?? 0;
    const passed = lastRun.passed ?? 0;
    const failed = lastRun.failed ?? 0;
    const finished = lastRun.finished_at
      ? new Date(lastRun.finished_at + "Z").toLocaleString("en-GB", {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "UTC",
        }) + " UTC"
      : "—";
    const fails =
      enabledApps?.filter((id) => resultsByApp?.[id]?.passed === 0) ?? [];
    const lines = [
      `Happy Path: ${passed}/${total} passed, ${failed} failed. Last run: ${finished}.`,
      fails.length ? `Failed: ${fails.join(", ")}` : null,
      base,
    ].filter(Boolean);
    return lines.join("\n");
  } catch (err) {
    return `Happy Path: error — ${err.message}. See ${base}`;
  }
}

export async function telegramSecuritySummary(_db, _opts) {
  return "PipeSecure/Semgrep summary: run manually or configure pipeline. See GitHub issues for 216labs.";
}

export async function telegramWeeklyLint(_db, _opts) {
  return "Weekly lint report: run `npm run lint` in repo or connect CI.";
}

/**
 * Hourly: poll Telegram updates for TELEGRAM_GROUP_HOURLY_CHAT_ID, draft reply via OpenAI, post to group.
 * Prefer TELEGRAM_GROUP_HOURLY_LISTENER_TOKEN if another service already calls getUpdates on TELEGRAM_BOT_TOKEN.
 */
export async function telegramGroupHourlyReply(db, _opts) {
  const chatId = process.env.TELEGRAM_GROUP_HOURLY_CHAT_ID || "";
  if (!chatId.trim()) {
    console.warn(
      "[cron-runner] telegram-group-hourly-reply: set TELEGRAM_GROUP_HOURLY_CHAT_ID"
    );
    return "";
  }

  const mainToken = process.env.TELEGRAM_BOT_TOKEN || "";
  const listenerToken =
    process.env.TELEGRAM_GROUP_HOURLY_LISTENER_TOKEN?.trim() || mainToken;
  if (!listenerToken) {
    console.warn(
      "[cron-runner] telegram-group-hourly-reply: TELEGRAM_BOT_TOKEN or TELEGRAM_GROUP_HOURLY_LISTENER_TOKEN required"
    );
    return "";
  }

  const apiKey =
    process.env.TELEGRAM_GROUP_HOURLY_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim() ||
    "";
  if (!apiKey) {
    console.warn(
      "[cron-runner] telegram-group-hourly-reply: set TELEGRAM_GROUP_HOURLY_OPENAI_API_KEY or OPENAI_API_KEY"
    );
    return "";
  }

  const model = process.env.TELEGRAM_GROUP_HOURLY_OPENAI_MODEL || "gpt-4o-mini";
  const lastRaw = getCronState(db, STATE_KEY_LAST_UPDATE);
  const startOffset = lastRaw ? parseInt(lastRaw, 10) + 1 : 1;

  let lines;
  let nextOffset;
  try {
    const collected = await collectGroupMessages(listenerToken, chatId, startOffset);
    lines = collected.lines;
    nextOffset = collected.nextOffset;
  } catch (err) {
    console.error("[cron-runner] telegram-group-hourly-reply getUpdates:", err);
    return `Group hourly reply: Telegram error — ${err.message}`;
  }

  setCronState(db, STATE_KEY_LAST_UPDATE, String(nextOffset - 1));

  const transcript =
    lines.length > 0
      ? lines.join("\n")
      : "(No new messages in this polling window.)";

  let reply;
  try {
    reply = await openaiReply(apiKey, model, transcript);
  } catch (err) {
    console.error("[cron-runner] telegram-group-hourly-reply OpenAI:", err);
    return `Group hourly reply: OpenAI error — ${err.message}`;
  }

  const trimmed = reply.length > 4096 ? reply.slice(0, 4093) + "…" : reply;

  const sendToken = listenerToken !== mainToken ? listenerToken : undefined;

  return {
    text: trimmed,
    chatId,
    sendToken,
  };
}

/**
 * Post a short test message as the first digital employee (Workforce registry)
 * to WORKFORCE_TELEGRAM_CHAT_ID using that employee's bot token.
 */
export async function workforceTelegramTest(db, _opts) {
  const storePath =
    process.env.WORKFORCE_STORE_PATH || "/app/workforce-data/workforce-employees.json";
  // Prefer dedicated workforce target; else same chat as other cron posts (env or admin DB).
  const chatId =
    process.env.WORKFORCE_TELEGRAM_CHAT_ID?.trim() ||
    getEnvVar(db, "WORKFORCE_TELEGRAM_CHAT_ID") ||
    process.env.TELEGRAM_CHAT_ID?.trim() ||
    getEnvVar(db, "TELEGRAM_CHAT_ID") ||
    "";

  if (!chatId) {
    console.warn(
      "[cron-runner] workforce-telegram-test: set WORKFORCE_TELEGRAM_CHAT_ID or TELEGRAM_CHAT_ID (admin Env / env_vars)"
    );
    return "";
  }

  if (!existsSync(storePath)) {
    return `Workforce test: no store file at ${storePath}`;
  }

  let store;
  try {
    store = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (err) {
    return `Workforce test: cannot read registry — ${err.message}`;
  }

  const employees = store?.employees;
  if (!Array.isArray(employees) || employees.length === 0) {
    return "Workforce test: no digital employees in the Workforce registry.";
  }

  const sorted = [...employees].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
  const employee = sorted[0];
  const token = employee.telegramBotToken?.trim();
  if (!token) {
    return "Workforce test: first employee has no Telegram bot token.";
  }

  const name = employee.name || "Digital employee";
  const text = `[Test] ${name} — cron ping (${new Date().toISOString()})`;

  return {
    text,
    chatId,
    sendToken: token,
  };
}

const EDGE_ROLLUP_STATE_KEY = "edge_rollup_log_bytes";
const DEFAULT_CADDY_LOG = "/var/log/caddy/access.log";

function hostToAppId(host, appHost) {
  if (!host || typeof host !== "string") return null;
  const h = host.split(":")[0].toLowerCase().trim();
  const base = (appHost || "6cubed.app").toLowerCase();
  if (h === base || h === `www.${base}`) return "landing";
  const suffix = `.${base}`;
  if (!h.endsWith(suffix)) return null;
  const sub = h.slice(0, -suffix.length);
  const first = sub.split(".")[0];
  return first || null;
}

function shouldCountLine(rec) {
  const st = rec.status;
  if (typeof st !== "number" || st >= 400 || st === 0) return false;
  const req = rec.request;
  if (!req || typeof req !== "object") return false;
  const method = req.method;
  if (method !== "GET" && method !== "HEAD") return false;
  const uri = typeof req.uri === "string" ? req.uri : "";
  if (uri.startsWith("/_next/static")) return false;
  if (uri === "/favicon.ico" || uri === "/robots.txt") return false;
  if (/\.(js|mjs|css|map|woff2?|ttf|png|jpg|jpeg|gif|svg|ico|webp|json)(\?|$)/i.test(uri)) return false;
  return true;
}

function visitorHash(clientIp, userAgent) {
  const ua = String(userAgent || "");
  const ip = String(clientIp || "");
  return createHash("sha256").update(`${ip}|${ua}`, "utf8").digest("hex").slice(0, 32);
}

function tsToDayUtc(ts) {
  const n = typeof ts === "number" ? ts : parseFloat(String(ts));
  if (!Number.isFinite(n)) return null;
  const ms = n > 1e12 ? Math.floor(n) : Math.floor(n * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Ingest new Caddy JSON access log lines into edge_visitor_day (216labs.db).
 * Returns empty string so cron does not post to Telegram.
 */
export async function edgeVisitorRollup(db) {
  const logPath = process.env.CADDY_ACCESS_LOG || DEFAULT_CADDY_LOG;
  const appHost = process.env.APP_HOST || "6cubed.app";
  if (!existsSync(logPath)) {
    return "";
  }

  let offset = 0;
  try {
    const row = db.prepare("SELECT value FROM cron_runner_state WHERE key = ?").get(EDGE_ROLLUP_STATE_KEY);
    if (row && row.value != null && row.value !== undefined) {
      offset = parseInt(String(row.value), 10) || 0;
    }
  } catch {
    offset = 0;
  }

  let size;
  try {
    size = statSync(logPath).size;
  } catch {
    return "";
  }
  if (size === 0) {
    db.prepare("INSERT OR REPLACE INTO cron_runner_state (key, value) VALUES (?, ?)").run(
      EDGE_ROLLUP_STATE_KEY,
      "0"
    );
    return "";
  }
  if (offset > size) offset = 0;

  const len = size - offset;
  if (len <= 0) return "";

  const fd = openSync(logPath, "r");
  const buf = Buffer.alloc(len);
  readSync(fd, buf, 0, len, offset);
  closeSync(fd);

  const text = buf.toString("utf8");
  const lines = text.split("\n");
  const insertStmt = db.prepare(
    "INSERT OR IGNORE INTO edge_visitor_day (app_id, day_utc, visitor_hash) VALUES (?, ?, ?)"
  );

  let processed = 0;
  for (const line of lines) {
    if (!line.trim()) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (!shouldCountLine(rec)) continue;
    const req = rec.request;
    const appId = hostToAppId(req.host, appHost);
    if (!appId) continue;

    const clientIp = req.client_ip || req.remote_ip || "";
    const headers = req.headers && typeof req.headers === "object" ? req.headers : {};
    const rawUa = headers["User-Agent"] || headers["User-agent"] || "";
    const ua = Array.isArray(rawUa) ? rawUa[0] : rawUa;

    const dayUtc = tsToDayUtc(rec.ts);
    if (!dayUtc) continue;

    const vh = visitorHash(clientIp, ua);
    insertStmt.run(appId, dayUtc, vh);
    processed += 1;
  }

  const newOffset = offset + buf.length;
  db.prepare("INSERT OR REPLACE INTO cron_runner_state (key, value) VALUES (?, ?)").run(
    EDGE_ROLLUP_STATE_KEY,
    String(newOffset)
  );

  if (processed > 0) {
    console.log(`[edge-visitor-rollup] ingested ${processed} qualifying lines`);
  }
  return "";
}

export const HANDLERS = {
  "telegram-daily-digest": telegramDailyDigest,
  "telegram-happypath-summary": telegramHappypathSummary,
  "telegram-security-summary": telegramSecuritySummary,
  "telegram-weekly-lint": telegramWeeklyLint,
  "telegram-group-hourly-reply": telegramGroupHourlyReply,
  "workforce-telegram-test": workforceTelegramTest,
  "edge-visitor-rollup": edgeVisitorRollup,
};
