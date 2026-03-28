import { Ga4ScriptInner } from "./Ga4ScriptInner";

const GA4_RE = /^G-[A-Z0-9]+$/;

/**
 * Injects GA4 when `GA_MEASUREMENT_ID` is set on the container (runtime).
 * Add to the root `app/layout.tsx` `<body>` (or next to it).
 */
export function Ga4Script() {
  const raw = process.env.GA_MEASUREMENT_ID?.trim();
  if (!raw || !GA4_RE.test(raw)) return null;
  return <Ga4ScriptInner measurementId={raw} />;
}
