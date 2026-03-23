/**
 * Heuristic flags for research only. OpenSky data is incomplete;
 * military aircraft may omit ADS-B; callsigns are not authoritative.
 */
export function isUsLinkedFlight(args: {
  originCountry: string | null;
  callsign: string | null;
}): boolean {
  const country = (args.originCountry || "").trim();
  if (country === "United States") return true;

  const raw = (args.callsign || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!raw) return false;

  const prefixes = [
    "RCH",
    "CNV",
    "REACH",
    "SAM",
    "EVAC",
    "QUID",
    "NAVY",
    "USAF",
    "ARMY",
    "SPAR",
    "BOXER",
    "CONVOY",
    "TABOO",
  ];
  const re = new RegExp(`^(${prefixes.join("|")})[0-9A-Z]*$`);
  return re.test(raw);
}
