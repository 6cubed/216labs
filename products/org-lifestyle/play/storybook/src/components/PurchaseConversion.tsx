"use client";

import { useEffect } from "react";
import { trackStorybookEvent } from "@/lib/analytics";

/** Fires GA4 purchase once on Stripe success redirect. */
export default function PurchaseConversion({ sessionId }: { sessionId?: string }) {
  useEffect(() => {
    if (!sessionId) return;
    trackStorybookEvent("purchase", { session_id: sessionId });
  }, [sessionId]);

  return null;
}
