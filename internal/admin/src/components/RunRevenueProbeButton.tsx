"use client";

import { useState } from "react";
import { runCronJobNow } from "@/app/actions";

export function RunRevenueProbeButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const run = () => {
    setPending(true);
    setError(null);
    setOk(false);
    runCronJobNow("revenue-env-check").then((result) => {
      setPending(false);
      if (result && "error" in result) {
        setError(result.error);
        return;
      }
      setOk(true);
      window.setTimeout(() => setOk(false), 3500);
    });
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-accent bg-accent/30 text-accent hover:bg-accent/50 disabled:opacity-50"
      >
        {pending ? "Running probe…" : "Run revenue probe now"}
      </button>
      {ok ? <p className="text-[11px] text-emerald-300">Queued. Refresh this page for the latest live probe.</p> : null}
      {error ? <p className="text-[11px] text-red-400 max-w-[520px]">{error}</p> : null}
    </div>
  );
}

