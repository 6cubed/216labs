"use client";

import { useState, useTransition } from "react";
import { fetchAppLogs } from "@/app/actions";

export function LogsButton({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const result = await fetchAppLogs(appId);
      setLines(result);
    });
  };

  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      setOpen(true);
      if (lines === null) load();
    }
  };

  return (
    <div>
      <button
        onClick={toggle}
        className="flex items-center gap-1 text-[11px] font-mono text-muted hover:text-foreground transition-colors mt-2 select-none"
      >
        <span
          className={`transition-transform duration-150 inline-block ${open ? "rotate-180" : ""}`}
        >
          ▾
        </span>
        logs
      </button>

      {open && (
        <div className="mt-2 rounded-lg border border-white/8 bg-black/30 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/8">
            <span className="text-[10px] font-mono text-muted">
              last 60 lines · stdout + stderr
            </span>
            <button
              onClick={load}
              disabled={isPending}
              className="text-[10px] font-mono text-muted hover:text-foreground transition-colors disabled:opacity-40"
            >
              {isPending ? "loading…" : "↻ refresh"}
            </button>
          </div>
          <div className="overflow-y-auto max-h-56 p-3">
            {isPending && lines === null ? (
              <p className="text-[10px] text-muted font-mono">Loading…</p>
            ) : lines && lines.length > 0 ? (
              <pre className="text-[10px] leading-relaxed font-mono text-muted/70 whitespace-pre-wrap break-all">
                {lines.join("\n")}
              </pre>
            ) : (
              <p className="text-[10px] text-muted font-mono">
                No logs available.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
