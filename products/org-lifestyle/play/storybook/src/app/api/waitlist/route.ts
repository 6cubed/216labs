import { NextRequest } from "next/server";
import {
  LANDING_WAITLIST_BOOK_ID,
  createPrintInterest,
} from "@/lib/db";
import { corsHeaders, corsJson, corsPreflight, isAllowedOrigin } from "@/lib/cors";
import { formatUtmLine, notifyAdminLead, trimUtmField } from "@/lib/lead-notify";

export async function OPTIONS(req: NextRequest) {
  return corsPreflight(req.headers.get("origin"));
}

/** Email-only waitlist from 6cubed.app or StoryMagic hero (CORS). Counts toward checkout/ready waitlistCount. */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");

  if (origin && !isAllowedOrigin(origin)) {
    return corsJson(origin, { error: "Origin not allowed" }, { status: 403 });
  }

  const body = (await req.json()) as {
    email?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  const email = (body.email ?? "").trim().toLowerCase();
  const utm = {
    utmSource: trimUtmField(body.utm_source) ?? "landing",
    utmMedium: trimUtmField(body.utm_medium) ?? "waitlist_form",
    utmCampaign: trimUtmField(body.utm_campaign) ?? "6cubed_home",
  };
  const utmLine = formatUtmLine(utm);

  if (!email) {
    return corsJson(origin, { error: "email required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return corsJson(origin, { error: "Invalid email" }, { status: 400 });
  }

  createPrintInterest(LANDING_WAITLIST_BOOK_ID, email, utm);
  await notifyAdminLead(email, LANDING_WAITLIST_BOOK_ID, "6cubed landing waitlist", utmLine);

  return corsJson(origin, { ok: true });
}
