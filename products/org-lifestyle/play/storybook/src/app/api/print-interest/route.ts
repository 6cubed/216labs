import { NextRequest, NextResponse } from "next/server";
import { createPrintInterest, getBook } from "@/lib/db";

const INGEST_URL =
  process.env.CLIENT_ERROR_REPORT_URL ??
  process.env.STORYBOOK_ERROR_INGEST_URL ??
  "http://admin:3000/api/public/leads";

async function notifyAdminLead(email: string, bookId: string, bookTitle: string) {
  try {
    await fetch(INGEST_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        kind: "lead",
        source_app_id: "storybook",
        message: `[Print lead] book "${bookTitle}" (${bookId})`,
      }),
      signal: AbortSignal.timeout(4000),
    });
  } catch {
    // Best-effort — lead is stored in storybook.db
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { bookId?: string; email?: string };
  const bookId = (body.bookId ?? "").trim();
  const email = (body.email ?? "").trim().toLowerCase();

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

  createPrintInterest(bookId, email);
  await notifyAdminLead(email, bookId, book.title);

  return NextResponse.json({ ok: true });
}
