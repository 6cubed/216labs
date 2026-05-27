/** Persist ad UTMs from the landing URL for waitlist attribution (sessionStorage). */

export type UtmFields = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
};

const STORAGE_KEY = "storybook_utm_v1";
const MAX_LEN = 120;

function trimUtm(value: string | null): string | undefined {
  const v = (value ?? "").trim().slice(0, MAX_LEN);
  return v || undefined;
}

/** Call once on page load — stores first-touch UTMs for this tab session. */
export function captureUtmFromUrl(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const next: UtmFields = {
      utm_source: trimUtm(params.get("utm_source")),
      utm_medium: trimUtm(params.get("utm_medium")),
      utm_campaign: trimUtm(params.get("utm_campaign")),
    };
    if (!next.utm_source && !next.utm_medium && !next.utm_campaign) return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function getStoredUtm(): UtmFields {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as UtmFields;
    return {
      utm_source: trimUtm(parsed.utm_source ?? null),
      utm_medium: trimUtm(parsed.utm_medium ?? null),
      utm_campaign: trimUtm(parsed.utm_campaign ?? null),
    };
  } catch {
    return {};
  }
}

export function formatUtmForMessage(utm: UtmFields): string {
  const parts: string[] = [];
  if (utm.utm_source) parts.push(`src=${utm.utm_source}`);
  if (utm.utm_medium) parts.push(`med=${utm.utm_medium}`);
  if (utm.utm_campaign) parts.push(`camp=${utm.utm_campaign}`);
  return parts.length ? ` | ${parts.join(" ")}` : "";
}
