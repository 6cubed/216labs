import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app").toLowerCase();

function corsHeaders(origin: string | null): HeadersInit {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
  if (origin && isAllowedOrigin(origin)) {
    h["Access-Control-Allow-Origin"] = origin;
    h.Vary = "Origin";
  }
  return h;
}

function isAllowedOrigin(origin: string): boolean {
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return true;
    if (host === APP_HOST || host === `www.${APP_HOST}`) return true;
    if (host.endsWith(`.${APP_HOST}`)) return true;
    return false;
  } catch {
    return false;
  }
}

/** In-memory rate limit: originHost -> { count, windowStartMs } */
const buckets = new Map<string, { count: number; start: number }>();
const RATE_LIMIT = 25;
const RATE_WINDOW_MS = 60_000;

function checkRate(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now - b.start > RATE_WINDOW_MS) {
    buckets.set(key, { count: 1, start: now });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

function originHost(origin: string | null): string {
  try {
    return origin ? new URL(origin).hostname.toLowerCase() : "unknown";
  } catch {
    return "unknown";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = {
  email?: string;
  message?: string;
  kind?: string;
  source_app_id?: string;
};

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (origin && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: "origin not allowed" }, { status: 403, headers });
  }

  const rateKey = originHost(origin);
  if (!checkRate(rateKey)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const kindRaw = typeof body.kind === "string" ? body.kind.trim().toLowerCase() : "lead";
  const kind = ["lead", "hire", "merch", "other"].includes(kindRaw) ? kindRaw : "lead";
  const sourceApp =
    typeof body.source_app_id === "string" ? body.source_app_id.trim().toLowerCase() : "landing";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "valid email required" }, { status: 400, headers });
  }
  if (message.length > 2000) {
    return NextResponse.json({ error: "message too long" }, { status: 400, headers });
  }

  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const referrer = req.headers.get("referer");
  const ua = req.headers.get("user-agent");

  const db = getDb();
  db.prepare(
    `INSERT INTO lead_event
      (id, created_at, source_app_id, kind, email, message, referrer, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(id, createdAt, sourceApp, kind, email, message, referrer, ua);

  return NextResponse.json({ ok: true, id }, { status: 201, headers });
}

