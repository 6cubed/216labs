"use client";

import { useTransition, useState, useEffect } from "react";
import { toggleAppDeploy } from "@/app/actions";

/**
 * Switch reflects **deploy_enabled** in SQLite (what ships / should run).
 * Runtime (running/stopped) is shown separately — do not conflate the two.
 */
export function DeployToggle({
  appId,
  deployEnabled,
}: {
  appId: string;
  deployEnabled: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [localEnabled, setLocalEnabled] = useState(deployEnabled);

  useEffect(() => {
    if (isPending) return;
    queueMicrotask(() => {
      setLocalEnabled((prev) => (prev === deployEnabled ? prev : deployEnabled));
    });
  }, [deployEnabled, isPending]);

  const active = isPending ? !localEnabled : localEnabled;

  const handleClick = () => {
    setError(null);
    const next = !localEnabled;
    startTransition(async () => {
      const result = await toggleAppDeploy(appId, next);
      if (result && "error" in result) {
        setError(result.error);
      } else {
        setLocalEnabled(next);
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        role="switch"
        aria-checked={active}
        aria-label={active ? "Disable deploy" : "Enable deploy"}
        disabled={isPending || appId === "admin"}
        onClick={handleClick}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full
          border border-white/10 transition-colors duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${active ? "bg-emerald-500/40" : "bg-white/5"}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-3.5 w-3.5 rounded-full
            shadow-sm transition-transform duration-200
            ${active ? "translate-x-4 bg-emerald-400" : "translate-x-0.5 bg-white/30"}
          `}
        />
      </button>
      {error && (
        <p className="text-[10px] text-red-400 max-w-[140px] text-right leading-tight">
          {error}
        </p>
      )}
    </div>
  );
}
