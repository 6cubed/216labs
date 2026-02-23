"use client";

import { useTransition } from "react";
import { toggleAppDeploy } from "@/app/actions";

export function DeployToggle({
  appId,
  enabled,
}: {
  appId: string;
  enabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? "Disable deploy" : "Enable deploy"}
      disabled={isPending}
      onClick={() =>
        startTransition(() => toggleAppDeploy(appId, !enabled))
      }
      className={`
        relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
        border border-white/10 transition-colors duration-200
        disabled:opacity-50 disabled:cursor-wait
        ${enabled ? "bg-emerald-500/40" : "bg-white/5"}
      `}
    >
      <span
        className={`
          pointer-events-none inline-block h-3.5 w-3.5 rounded-full
          shadow-sm transition-transform duration-200
          ${enabled ? "translate-x-4 bg-emerald-400" : "translate-x-0.5 bg-white/30"}
        `}
      />
    </button>
  );
}
