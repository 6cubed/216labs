import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  fingerprintFor,
  insertClientErrorEvent,
  type ClientErrorKind,
} from "@/lib/client-error-store";

export const dynamic = "force-dynamic";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app").toLowerCase();
const APP_ID_RE = /^[a-z0-9][a-z0-9.-]*$/;

/** In-memory rate limit: app_id -> { count, windowStartMs } */
const buckets = new Map<string, { count: number; start: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 60_000;

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

function appIdFromOrigin(origin: string | null): string | null {
  if (!origin) return null;
  try {
    const host = new URL(origin).hostname.toLowerCase();
    if (host === APP_HOST || host === `www.${APP_HOST}`) return "landing";
    if (host.endsWith(`.${APP_HOST}`)) {
      const sub = host.slice(0, -(APP_HOST.length + 1));
      const id = sub.split(".")[0];
      return APP_ID_RE.test(id) ? id : null;
    }
    if (host === "localhost" || host === "127.0.0.1") return "localhost";
  } catch {
    return null;
  }
  return null;
}

function checkRate(appId: string): boolean {
  const now = Date.now();
  const b = buckets.get(appId);
  if (!b || now - b.start > RATE_WINDOW_MS) {
    buckets.set(appId, { count: 1, start: now });
    return true;
  }
  if (b.count >= RATE_LIMIT) return false;
  b.count += 1;
  return true;
}

type Body = {
  app_id?: string;
  kind?: string;
  message?: string;
  stack?: string;
  url?: string;
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

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400, headers });
  }

  let appId = typeof body.app_id === "string" ? body.app_id.trim().toLowerCase() : "";
  if (!appId || !APP_ID_RE.test(appId)) {
    appId = appIdFromOrigin(origin) || "";
  }
  if (!appId || !APP_ID_RE.test(appId)) {
    return NextResponse.json({ error: "app_id required or derivable from Origin" }, { status: 400, headers });
  }

  if (!checkRate(appId)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers });
  }

  const kind: ClientErrorKind = body.kind === "server" ? "server" : "client";
  const stack = typeof body.stack === "string" ? body.stack : undefined;
  const url =
    typeof body.url === "string"
      ? body.url
      : req.headers.get("referer") || undefined;

  const db = getDb();
  const id = insertClientErrorEvent(db, {
    appId,
    kind,
    message,
    stack,
    url,
  });

  return NextResponse.json(
    { ok: true, id, fingerprint: fingerprintFor(appId, kind, message) },
    { status: 201, headers },
  );
}
