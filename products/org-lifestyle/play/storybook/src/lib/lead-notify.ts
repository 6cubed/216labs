const INGEST_URL =
  process.env.CLIENT_ERROR_REPORT_URL ??
  process.env.STORYBOOK_ERROR_INGEST_URL ??
  "http://admin:3000/api/public/leads";

export function trimUtmField(v: unknown, max = 120): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.trim().slice(0, max);
  return s || undefined;
}

export function formatUtmLine(utm: {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): string {
  const { utmSource, utmMedium, utmCampaign } = utm;
  if (!utmSource && !utmMedium && !utmCampaign) return "";
  return ` | src=${utmSource ?? "—"} med=${utmMedium ?? "—"} camp=${utmCampaign ?? "—"}`;
}

export async function notifyAdminLead(
  email: string,
  bookId: string,
  bookTitle: string,
  utmLine: string
): Promise<void> {
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
    /* best-effort */
  }
}
