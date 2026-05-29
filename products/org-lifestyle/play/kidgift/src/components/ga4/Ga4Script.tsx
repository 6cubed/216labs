import { Ga4ScriptInner } from "./Ga4ScriptInner";

const GA4_RE = /^G-[A-Z0-9]+$/;

export function Ga4Script() {
  const raw = process.env.GA_MEASUREMENT_ID?.trim();
  if (!raw || !GA4_RE.test(raw)) return null;
  return <Ga4ScriptInner measurementId={raw} />;
}
