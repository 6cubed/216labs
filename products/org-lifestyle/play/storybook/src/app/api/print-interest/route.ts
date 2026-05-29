import { NextRequest, NextResponse } from "next/server";
import { createPrintInterest, getBook } from "@/lib/db";
import { formatUtmLine, notifyAdminLead, trimUtmField } from "@/lib/lead-notify";

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
  const utmLine = formatUtmLine({
    utmSource,
    utmMedium,
    utmCampaign,
  });

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
