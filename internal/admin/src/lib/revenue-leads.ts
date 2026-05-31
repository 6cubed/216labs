import { getDb } from "@/lib/db";

export type OnePageWaitlistLead = {
  id: string;
  created_at: string;
  email: string;
  message: string;
};

type LeadLike = {
  kind?: string;
  message?: string;
  source_app_id?: string;
};

/** Includes legacy rows stored as kind=lead before storymagic_partner was allowed. */
export function isStorymagicPartnerLead(r: LeadLike): boolean {
  const kind = (r.kind ?? "").trim();
  if (kind === "storymagic_partner") return true;
  const msg = (r.message ?? "").trim().toLowerCase();
  return msg.includes("storymagic partnership inquiry");
}

/** Emails from 1PageResearch generate page “Notify me at launch”. */
export function isOnePageCheckoutWaitlistLead(row: {
  source_app_id?: string;
  message?: string;
}): boolean {
  const source = (row.source_app_id ?? "").trim().toLowerCase();
  const msg = (row.message ?? "").trim().toLowerCase();
  return source === "1pageresearch" && msg.includes("checkout waitlist");
}

export function countOnePageCheckoutWaitlist(): number {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM lead_event
       WHERE source_app_id = '1pageresearch'
         AND message LIKE '%checkout waitlist%'`
    )
    .get() as { n: number };
  return row?.n ?? 0;
}

export function fetchOnePageCheckoutWaitlist(limit = 50): OnePageWaitlistLead[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, created_at, email, message
       FROM lead_event
       WHERE source_app_id = '1pageresearch'
         AND message LIKE '%checkout waitlist%'
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .all(limit) as OnePageWaitlistLead[];
}
