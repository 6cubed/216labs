/**
 * Job handlers: each returns a string (message to send to Telegram) or
 * { text, chatId?, sendToken? } to target a different chat and/or bot token.
 * opts: { HAPPYPATH_INTERNAL_URL }
 */

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

export const HANDLERS = {
  "telegram-daily-digest": telegramDailyDigest,
  "telegram-happypath-summary": telegramHappypathSummary,
  "telegram-security-summary": telegramSecuritySummary,
  "telegram-weekly-lint": telegramWeeklyLint,
  "telegram-group-hourly-reply": telegramGroupHourlyReply,
};
