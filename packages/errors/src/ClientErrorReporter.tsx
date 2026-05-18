"use client";

import { useEffect } from "react";
import { installBrowserErrorReporting } from "./report-error";

/**
 * Install window.onerror + unhandledrejection → admin ingest.
 * Add once in root layout (client component).
 */
export function ClientErrorReporter(props: { appId?: string; endpoint?: string }) {
  useEffect(() => {
    installBrowserErrorReporting({
      appId: props.appId,
      endpoint: props.endpoint,
    });
  }, [props.appId, props.endpoint]);
  return null;
}
