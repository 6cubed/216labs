/**
 * Job handlers: each returns a string (message to send to Telegram) or
 * { text, chatId?, sendToken? } to target a different chat and/or bot token.
 * opts: { HAPPYPATH_INTERNAL_URL }
 */

import { createHash } from "crypto";
import http from "http";
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
    if (!row) return "";
    const v = row.value ?? row.VALUE;
    if (v == null || v === "") return "";
    const s = String(v).trim();
    return s || "";
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
      "[cron-runner] workforce-telegram-test: no chat id in process env yet; sendToTelegram will still try WORKFORCE_TELEGRAM_CHAT_ID / TELEGRAM_CHAT_ID from env_vars"
    );
  }

  const chatPayload = chatId ? { chatId } : {};

  if (!existsSync(storePath)) {
    return {
      text: `Workforce: registry file missing at ${storePath}. Add a digital employee in Admin → Workforce (or create that JSON on the host).`,
      ...chatPayload,
    };
  }

  let store;
  try {
    store = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (err) {
    return {
      text: `Workforce: cannot read registry — ${err.message}`,
      ...chatPayload,
    };
  }

  const employees = store?.employees;
  if (!Array.isArray(employees) || employees.length === 0) {
    return {
      text:
        "Workforce: no digital employees in the registry yet. Add one in Admin → Workforce; the next run will post using that bot’s token.",
      ...chatPayload,
    };
  }

  const sorted = [...employees].sort((a, b) =>
    String(a.createdAt || "").localeCompare(String(b.createdAt || ""))
  );
  const employee = sorted[0];
  const token = employee.telegramBotToken?.trim();
  if (!token) {
    return {
      text: "Workforce: first digital employee has no Telegram bot token — edit them in Admin → Workforce.",
      ...chatPayload,
    };
  }

  const name = employee.name || "Digital employee";
  const text = `[Test] ${name} — cron ping (${new Date().toISOString()})`;

  return {
    text,
    ...chatPayload,
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

const REVENUE_PROBE_STATE_KEY = "revenue_env_last";

async function fetchCheckoutReady(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(18_000),
    redirect: "follow",
  });
  const text = await res.text();
  if (!text.includes('"ready"')) {
    return {
      ok: false,
      status: res.status,
      ready: null,
      message: null,
      error: "no-json",
    };
  }
  const data = JSON.parse(text);
  return {
    ok: true,
    status: res.status,
    ready: Boolean(data.ready),
    message: typeof data.message === "string" ? data.message : null,
    error: null,
  };
}

/** Public edge first; fall back to Docker DNS when outbound HTTPS blips (common during VPS wedge). */
async function fetchCheckoutReadyResilient(publicUrl, internalUrl) {
  try {
    return await fetchCheckoutReady(publicUrl);
  } catch (e) {
    if (!internalUrl) throw e;
    return await fetchCheckoutReady(internalUrl);
  }
}

async function fetchMerchStorefront(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(18_000),
    redirect: "follow",
  });
  const html = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, ready: null, error: `HTTP ${res.status}` };
  }
  const fallback =
    html.includes("Checkout URL not configured") || html.includes("Shop StoryMagic");
  return {
    ok: true,
    status: res.status,
    ready: !fallback,
    message: fallback ? "merch fallback CTA" : "storefront ok",
    error: null,
  };
}

/** Read HTML via Caddy (merch container may be stopped; edge route still answers). */
function fetchCaddyHostBody(host, path = "/", ms = 12_000) {
  return new Promise((resolve, reject) => {
    const p = path.startsWith("/") ? path : `/${path}`;
    const chunks = [];
    const req = http.request(
      {
        host: "caddy",
        port: 80,
        method: "GET",
        path: p,
        headers: { Host: host, Connection: "close" },
      },
      (res) => {
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode || 0,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      }
    );
    req.setTimeout(ms, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

function merchProbeFromHtml(statusCode, html, via) {
  const transportOk =
    (statusCode >= 200 && statusCode < 400) ||
    statusCode === 401 ||
    statusCode === 308;
  if (!transportOk) {
    return {
      ok: false,
      status: statusCode,
      ready: null,
      error: `HTTP ${statusCode}`,
      via,
    };
  }
  const fallback =
    html.includes("Checkout URL not configured") || html.includes("Shop StoryMagic");
  return {
    ok: true,
    status: statusCode,
    ready: !fallback,
    message: fallback ? "merch fallback CTA" : "storefront ok",
    error: null,
    via,
  };
}

/** Prefer in-network merch app (avoids Caddy 308→HTTPS with empty body); then Caddy Host; then edge. */
async function probeMerchStorefront() {
  try {
    return { ...(await fetchMerchStorefront("http://merch:3000/")), via: "internal" };
  } catch {
    try {
      const { statusCode, body } = await fetchCaddyHostBody("merch.6cubed.app", "/", 12_000);
      return merchProbeFromHtml(statusCode, body, "caddy");
    } catch (e) {
      try {
        return { ...(await fetchMerchStorefront("https://merch.6cubed.app/")), via: "external" };
      } catch {
        return {
          ok: false,
          status: 0,
          ready: null,
          error: e instanceof Error ? e.message : "unreachable",
          via: null,
        };
      }
    }
  }
}

/** Caddy may return 401 (gate) or 308 (redirect) before the admin app responds. */
function adminEdgeStatusOk(status) {
  return status === 200 || status === 401 || status === 308;
}

/** Docker DNS first — avoids false "admin fetch failed" when outbound HTTPS blips. */
async function probeAdminResilient() {
  // Root (/) can be slow/hang due to heavy SSR; use a lightweight public API route.
  // GET returns 405 but proves the app is reachable.
  const path = "/api/public/leads";
  const attempts = [
    { url: `http://admin:3000${path}`, via: "internal" },
    { url: `https://admin.6cubed.app${path}`, via: "external" },
  ];
  let lastErr = "unreachable";
  for (const { url, via } of attempts) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10_000),
        redirect: "follow",
      });
      const adminOk = res.status === 204 || res.status === 200 || res.status === 201 || res.status === 405;
      if (adminOk) {
        return {
          ok: true,
          status: res.status,
          error: null,
          via,
        };
      }
      lastErr = `HTTP ${res.status} (${via})`;
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, status: 0, error: lastErr, via: null };
}

/**
 * Twice-daily edge + revenue probe; Telegram only when something is broken.
 * Persists JSON in cron_runner_state for admin Env page.
 */
export async function revenueEnvCheck(db) {
  const at = new Date().toISOString();
  const results = [];
  let issues = 0;

  {
    const admin = await probeAdminResilient();
    results.push({
      id: "admin",
      label: "Admin",
      ok: admin.ok,
      status: admin.status,
      error: admin.error,
      via: admin.via ?? undefined,
    });
    if (!admin.ok) issues += 1;
  }

  for (const { id, label, url, internalUrl } of [
    {
      id: "storybook",
      label: "StoryMagic",
      url: "https://storybook.6cubed.app/api/checkout/ready",
      internalUrl: "http://storybook:3000/api/checkout/ready",
    },
    {
      id: "1pageresearch",
      label: "1PageResearch",
      url: "https://1pageresearch.6cubed.app/api/checkout/ready",
      internalUrl: "http://1pageresearch:5000/api/checkout/ready",
    },
  ]) {
    try {
      const p = await fetchCheckoutReadyResilient(url, internalUrl);
      const row = {
        id,
        label,
        ok: p.ok,
        status: p.status,
        ready: p.ready,
        message: p.message,
        error: p.error,
      };
      results.push(row);
      if (!p.ok) issues += 1;
    } catch (e) {
      results.push({
        id,
        label,
        ok: false,
        status: 0,
        ready: null,
        error: e instanceof Error ? e.message : "unreachable",
      });
      issues += 1;
    }
  }

  {
    const p = await probeMerchStorefront();
    results.push({
      id: "merch",
      label: "Merch",
      ok: p.ok,
      status: p.status,
      ready: p.ready,
      message: p.message,
      error: p.error,
      via: p.via ?? undefined,
    });
    if (!p.ok) issues += 1;
  }

  const snapshot = { at, issues, results };
  setCronState(db, REVENUE_PROBE_STATE_KEY, JSON.stringify(snapshot));

  if (issues === 0) return "";

  const lines = results
    .filter((r) => !r.ok)
    .map((r) => `• ${r.label}: ${r.error || `HTTP ${r.status}`}`);
  return `[Revenue/Edge] ${issues} probe(s) failed:\n${lines.join("\n")}\nRun ./scripts/droplet-recover.sh or see docs/DROPLET-RECOVERY.md`;
}

export const STACK_HEALTH_STATE_KEY = "stack_health_last";

function fetchTimeout(url, ms = 10_000) {
  return fetch(url, { signal: AbortSignal.timeout(ms), redirect: "follow" });
}

async function fetchCaddyHost(host, path = "/", ms = 10_000) {
  return new Promise((resolve, reject) => {
    const p = path.startsWith("/") ? path : `/${path}`;
    const req = http.request(
      {
        host: "caddy",
        port: 80,
        method: "GET",
        path: p,
        headers: {
          Host: host,
          Connection: "close",
        },
      },
      (res) => {
        // Drain body; only status matters for probes.
        res.on("data", () => {});
        res.on("end", () => resolve(res));
      }
    );
    req.setTimeout(ms, () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

/**
 * Every 15m: public edge vs in-network spine. Surfaces "Caddy down, apps fine" vs full outage.
 * Persists JSON in cron_runner_state; admin dashboard reads stack_health_last.
 */
export async function stackHealthCheck(db) {
  const at = new Date().toISOString();
  const external = [];
  const internal = [];
  let extIssues = 0;

  try {
    // Prefer probing Caddy directly inside Docker (stable even if outbound HTTPS is flaky).
    const res = await fetchCaddyHost("admin.6cubed.app", "/", 8000);
    // 308 is expected (HTTP→HTTPS redirect); treat as edge-OK.
    const ok = res.statusCode === 200 || res.statusCode === 401 || res.statusCode === 308;
    external.push({
      id: "admin",
      ok,
      status: res.statusCode,
      error: ok ? null : `HTTP ${res.statusCode}`,
    });
    if (!ok) extIssues += 1;
  } catch (e) {
    external.push({
      id: "admin",
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "unreachable",
    });
    extIssues += 1;
  }

  try {
    const res = await fetchCaddyHost("6cubed.app", "/", 8000);
    const ok = res.statusCode >= 200 && res.statusCode < 500;
    external.push({
      id: "landing",
      ok,
      status: res.statusCode,
      error: ok ? null : `HTTP ${res.statusCode}`,
    });
    if (!ok) extIssues += 1;
  } catch (e) {
    external.push({
      id: "landing",
      ok: false,
      status: 0,
      error: e instanceof Error ? e.message : "unreachable",
    });
    extIssues += 1;
  }

  const internalTargets = [
    { id: "admin", url: "http://admin:3000/", okStatuses: [200, 401] },
    { id: "activator", url: "http://activator:3040/healthz", okStatuses: [200] },
    {
      id: "storybook",
      url: "http://storybook:3000/api/checkout/ready",
      needsReadyJson: true,
    },
  ];

  for (const t of internalTargets) {
    try {
      const res = await fetchTimeout(t.url, t.id === "admin" ? 12_000 : 8000);
      const text = t.needsReadyJson ? await res.text() : "";
      let ok = t.okStatuses ? t.okStatuses.includes(res.status) : res.ok;
      if (t.needsReadyJson) ok = text.includes('"ready"');
      internal.push({
        id: t.id,
        ok,
        status: res.status,
        error: ok ? null : `HTTP ${res.status}`,
      });
    } catch (e) {
      internal.push({
        id: t.id,
        ok: false,
        status: 0,
        error: e instanceof Error ? e.message : "unreachable",
      });
    }
  }

  const extOk = extIssues === 0;
  const intCoreOk = internal
    .filter((r) => r.id === "admin" || r.id === "activator")
    .every((r) => r.ok);
  const intAnyOk = internal.some((r) => r.ok);

  let diagnosis = "ok";
  if (!extOk && intCoreOk) diagnosis = "edge_proxy";
  else if (!extOk && !intAnyOk) diagnosis = "spine_down";
  else if (!extOk) diagnosis = "degraded";

  const snapshot = {
    at,
    issues: extIssues,
    diagnosis,
    external,
    internal,
  };
  setCronState(db, STACK_HEALTH_STATE_KEY, JSON.stringify(snapshot));

  if (extOk) return "";

  const lines = [];
  if (diagnosis === "edge_proxy") {
    lines.push(
      "Public edge down; admin/activator OK inside Docker — likely Caddy, TLS, or DNS."
    );
    lines.push("Try: ./scripts/droplet-spine-up.sh (reload caddy + spine).");
  } else if (diagnosis === "spine_down") {
    lines.push("Public and internal probes failed — VPS wedged or compose down.");
    lines.push("Try: DO reboot → ./scripts/wait-for-droplet.sh");
  } else {
    lines.push(`External probes failing (diagnosis: ${diagnosis}).`);
    lines.push("Try: ./scripts/droplet-recover.sh");
  }
  for (const r of external.filter((x) => !x.ok)) {
    lines.push(`• ${r.id}: ${r.error || `HTTP ${r.status}`}`);
  }
  return `[Stack health]\n${lines.join("\n")}`;
}

const DIFFTINDER_IDEA_POOL = [
  "Add a revenue readiness score to admin Overview that ranks apps by env keys + last deploy + edge traffic.",
  "Ship a single shared ADMIN_PANEL_PASSWORD login across workforce, groundtruth, and difftinder (retire Caddy basic auth for sub-apps).",
  "Wire agitweet autopost to difftinder-approved ideas only — closed loop from swipe yes to public brain dump.",
  "Add Stripe tip jar to tortellini with a one-click €3 preset; measure conversion in edge_visitor_day.",
  "Expose GHCR image digest + build time on each app card in admin Applications.",
  "Cron job: weekly 'stale manifest' report when docker_service in compose ≠ manifest id.",
  "Landing page section: 'Shipped this week' fed from deployment-feed API with deep links.",
  "Add Pocket bridge command /deploy <app_id> that triggers activator warmup + health probe.",
  "Hivefind: export mystery timeline as printable PDF for B2B workshops.",
  "OneFit: affiliate deep-link generator in admin with UTM templates per campaign.",
];

async function difftinderGenerateBody(db) {
  const key =
    getEnvVar(db, "OPENAI_API_KEY") ||
    getEnvVar(db, "TELEGRAM_GROUP_HOURLY_OPENAI_API_KEY") ||
    process.env.OPENAI_API_KEY ||
    "";
  if (!key) {
    const pick = DIFFTINDER_IDEA_POOL[Math.floor(Math.random() * DIFFTINDER_IDEA_POOL.length)];
    return { title: "Speculative idea", body: pick };
  }
  const model =
    getEnvVar(db, "DIFFTINDER_OPENAI_MODEL") ||
    getEnvVar(db, "TELEGRAM_GROUP_HOURLY_OPENAI_MODEL") ||
    "gpt-4o-mini";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You generate one concise speculative product/engineering idea for the 216labs monorepo (many small apps on *.6cubed.app). Output JSON only: {\"title\":\"short title\",\"body\":\"2-4 sentences, actionable, high leverage\"}. No markdown.",
        },
        {
          role: "user",
          content:
            "Today's idea should be novel, shippable within a day or two, and relevant to revenue, reliability, or developer velocity.",
        },
      ],
      max_tokens: 280,
      temperature: 0.85,
    }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || "";
  try {
    const parsed = JSON.parse(String(raw).trim());
    if (parsed?.body) {
      return {
        title: String(parsed.title || "Speculative idea").slice(0, 120),
        body: String(parsed.body).slice(0, 2000),
      };
    }
  } catch {
    // fall through
  }
  const pick = DIFFTINDER_IDEA_POOL[Math.floor(Math.random() * DIFFTINDER_IDEA_POOL.length)];
  return { title: "Speculative idea", body: pick };
}

/** Insert today's difftinder card if missing (cron-runner → difftinder internal API). */
export async function difftinderDailyIdea(db) {
  const base =
    process.env.DIFFTINDER_INTERNAL_URL?.trim() || "http://difftinder:5000";
  const secret =
    getEnvVar(db, "DIFFTINDER_INGEST_SECRET") ||
    getEnvVar(db, "CRON_RUNNER_SECRET") ||
    process.env.CRON_RUNNER_SECRET ||
    "";
  if (!secret) {
    return "[DiffTinder] skipped — set CRON_RUNNER_SECRET or DIFFTINDER_INGEST_SECRET";
  }
  const day = new Date().toISOString().slice(0, 10);
  const headers = {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  };
  const check = await fetch(`${base.replace(/\/$/, "")}/api/internal/today`, {
    headers,
    signal: AbortSignal.timeout(15000),
  });
  if (!check.ok) {
    return `[DiffTinder] today check failed HTTP ${check.status}`;
  }
  const checkData = await check.json();
  if (checkData.exists) {
    return `[DiffTinder] ${day}: idea already present`;
  }
  const idea = await difftinderGenerateBody(db);
  const post = await fetch(`${base.replace(/\/$/, "")}/api/internal/daily-idea`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      day_utc: day,
      title: idea.title,
      body: idea.body,
      source: "cron",
    }),
    signal: AbortSignal.timeout(20000),
  });
  if (!post.ok) {
    const t = await post.text();
    return `[DiffTinder] ingest failed ${post.status}: ${t.slice(0, 160)}`;
  }
  const posted = await post.json();
  if (posted.skipped) {
    return `[DiffTinder] ${day}: skipped (${posted.reason || "duplicate"})`;
  }
  return `[DiffTinder] ${day}: new idea — ${idea.title}`;
}

/** Compose + publish one Agitweet post (RSS news mix + prompts on the agitweet service). */
export async function agitweetAutopost(db) {
  const base =
    process.env.AGITWEET_INTERNAL_URL?.trim() || "http://agitweet:5000";
  const secret =
    getEnvVar(db, "AGITWEET_API_TOKEN") ||
    getEnvVar(db, "CRON_RUNNER_SECRET") ||
    process.env.CRON_RUNNER_SECRET ||
    "";
  if (!secret) {
    return "[Agitweet] skipped — set AGITWEET_API_TOKEN in admin Env";
  }
  const res = await fetch(`${base.replace(/\/$/, "")}/api/internal/autopost`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: "{}",
    signal: AbortSignal.timeout(90_000),
  });
  if (!res.ok) {
    const errBody = (await res.text()).slice(0, 160);
    return `[Agitweet] autopost failed HTTP ${res.status}: ${errBody}`;
  }
  const data = await res.json();
  const preview = String(data.text || "").slice(0, 100);
  return `[Agitweet] posted id=${data.id}: ${preview}${preview.length >= 100 ? "…" : ""}`;
}

const LEAD_NOTIFY_STATE_KEY = "lead-notify:seen_ids";

/** Parse StoryMagic print-lead UTMs from ingest message (`| src=… med=… camp=…`). */
function formatPrintLeadCampaign(message) {
  const msg = String(message || "");
  const src = msg.match(/\bsrc=([^\s|]+)/)?.[1];
  const med = msg.match(/\bmed=([^\s|]+)/)?.[1];
  const camp = msg.match(/\bcamp=([^\s|]+)/)?.[1];
  if (!src && !med && !camp) return "";
  const parts = [];
  if (src) parts.push(`source: ${src}`);
  if (med) parts.push(`medium: ${med}`);
  if (camp) parts.push(`campaign: ${camp}`);
  return `\n📣 ${parts.join(" · ")}`;
}

/**
 * Telegram ping for new rows in lead_event (landing hire form, etc.).
 * Dedupes by id in cron_runner_state; returns empty string when nothing new.
 */
export async function leadNotify(db) {
  let tableOk = true;
  try {
    db.prepare("SELECT 1 FROM lead_event LIMIT 1").get();
  } catch {
    tableOk = false;
  }
  if (!tableOk) return "";

  const rows = db
    .prepare(
      `SELECT id, created_at, kind, email, message, source_app_id
       FROM lead_event
       ORDER BY created_at ASC
       LIMIT 50`
    )
    .all();

  let seen = new Set();
  try {
    const raw = getCronState(db, LEAD_NOTIFY_STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const id of parsed) seen.add(String(id));
      }
    }
  } catch {
    seen = new Set();
  }

  // First run: mark existing leads as seen (avoid a backlog spam on deploy).
  if (seen.size === 0 && rows.length > 0) {
    for (const r of rows) {
      if (r?.id) seen.add(String(r.id));
    }
    setCronState(db, LEAD_NOTIFY_STATE_KEY, JSON.stringify([...seen].slice(-200)));
    return "";
  }

  const fresh = rows.filter((r) => r?.id && !seen.has(String(r.id)));
  if (fresh.length === 0) return "";

  for (const r of rows) {
    if (r?.id) seen.add(String(r.id));
  }
  const seenArr = [...seen].slice(-200);
  setCronState(db, LEAD_NOTIFY_STATE_KEY, JSON.stringify(seenArr));

  const blocks = fresh.map((r) => {
    const email = String(r.email || "").trim();
    const kind = String(r.kind || "lead").trim();
    const src = String(r.source_app_id || "landing").trim();
    const when = String(r.created_at || "").trim();
    const msg = String(r.message || "").trim();
    const preview = msg ? (msg.length > 240 ? `${msg.slice(0, 237)}…` : msg) : "(no message)";
    const campaign =
      src === "storybook" || msg.includes("[Print lead]") ? formatPrintLeadCampaign(msg) : "";
    return (
      `📩 New lead (${kind})\n` +
      `${email}\n` +
      `${preview}${campaign}\n` +
      `Source: ${src} · ${when}\n` +
      `https://admin.6cubed.app/leads`
    );
  });

  const header =
    fresh.length === 1
      ? "216labs — 1 new lead"
      : `216labs — ${fresh.length} new leads`;
  return `${header}\n\n${blocks.join("\n\n")}`;
}

/** Drop client/server error rows older than 14 days. */
export async function clientErrorPrune(ctx) {
  const db = ctx.db;
  const r = db.prepare(
    `DELETE FROM client_error_event WHERE datetime(occurred_at) < datetime('now', '-14 days')`
  ).run();
  const n = r.changes ?? 0;
  if (n > 0) console.log(`[client-error-prune] deleted ${n} row(s)`);
  return "";
}

/** Daily: nudge the org to publish the CEO-inspired "gospel" blog post. */
export async function blogDailyGospel(_db, _opts) {
  const iso = new Date().toISOString().slice(0, 16).replace("T", " ");
  return [
    "✍️ Daily gospel (blog)",
    "",
    "Write today’s blog post based on the CEO’s latest direction.",
    "In Pocket Cursor (Telegram): /blogdraft → edit → ship blog.",
    "",
    "• Blog: https://blog.6cubed.app",
    "• Direction inbox: /inbox",
    `(${iso} UTC)`,
  ].join("\n");
}

export const HANDLERS = {
  "telegram-daily-digest": telegramDailyDigest,
  "telegram-happypath-summary": telegramHappypathSummary,
  "telegram-security-summary": telegramSecuritySummary,
  "telegram-weekly-lint": telegramWeeklyLint,
  "telegram-group-hourly-reply": telegramGroupHourlyReply,
  "workforce-telegram-test": workforceTelegramTest,
  "edge-visitor-rollup": edgeVisitorRollup,
  "client-error-prune": clientErrorPrune,
  "revenue-env-check": revenueEnvCheck,
  "blog-daily-gospel": blogDailyGospel,
  "stack-health-check": stackHealthCheck,
  "difftinder-daily-idea": difftinderDailyIdea,
  "agitweet-autopost": agitweetAutopost,
  "lead-notify": leadNotify,
};
