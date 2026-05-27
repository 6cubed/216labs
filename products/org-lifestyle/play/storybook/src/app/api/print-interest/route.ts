import { NextRequest, NextResponse } from "next/server";
import { createPrintInterest, getBook } from "@/lib/db";

const INGEST_URL =
  process.env.CLIENT_ERROR_REPORT_URL ??
  process.env.STORYBOOK_ERROR_INGEST_URL ??
  "http://admin:3000/api/public/leads";

async function notifyAdminLead(
  email: string,
  bookId: string,
  bookTitle: string,
  utmLine: string
) {
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        kind: "lead",
        source_app_id: "storybook",
        message: `[Print lead] book "${bookTitle}" (${bookId})${utmLine}`,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Best-effort — lead is stored in storybook.db
  }
}

function trimUtmField(v: unknown, max = 120): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    bookId?: string;
    email?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
  };
  const bookId = (body.bookId ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();
  const utmSource = trimUtmField(body.utm_source);
  const utmMedium = trimUtmField(body.utm_medium);
  const utmCampaign = trimUtmField(body.utm_campaign);
  const utmLine =
    utmSource || utmMedium || utmCampaign
      ? ` | src=${utmSource ?? "—"} med=${utmMedium ?? "—"} camp=${utmCampaign ?? "—"}`
      : "";

  if (!bookId || !email) {
    return NextResponse.json({ error: "bookId and email required" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const book = getBook(bookId);
  if (!book) {
    return NextResponse.json({ error: "Book not found" }, { status: 404 });
  }

  createPrintInterest(bookId, email, {
    utmSource,
    utmMedium,
    utmCampaign,
  });
  await notifyAdminLead(email, bookId, book.title, utmLine);

  return NextResponse.json({ ok: true });
}
