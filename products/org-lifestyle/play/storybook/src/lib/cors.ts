import { NextResponse } from "next/server";

const APP_HOST = (process.env.NEXT_PUBLIC_APP_HOST || "6cubed.app").toLowerCase();

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
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

export function corsHeaders(origin: string | null): HeadersInit {
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

export function corsPreflight(origin: string | null) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}

export function corsJson(
  origin: string | null,
  body: unknown,
  init?: { status?: number }
) {
  return NextResponse.json(body, {
    status: init?.status ?? 200,
    headers: corsHeaders(origin),
  });
}
