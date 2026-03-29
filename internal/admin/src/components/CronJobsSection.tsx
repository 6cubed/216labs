"use client";

import { useState, useTransition } from "react";
import { setCronJobEnabledAction, runCronJobNow } from "@/app/actions";
import type { DbCronJob } from "@/lib/db";

function CronJobRow({ job }: { job: DbCronJob }) {
  const [isPending, startTransition] = useTransition();
  const [runPending, setRunPending] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(job.enabled === 1);

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    setRunError(null);
    startTransition(async () => {
      await setCronJobEnabledAction(job.id, next);
    });
  };

  const handleRunNow = () => {
    setRunError(null);
    setRunPending(true);
    runCronJobNow(job.id).then((result) => {
      setRunPending(false);
      if (result && "error" in result) setRunError(result.error);
    });
  };

  return (
    <tr className="border-t border-border hover:bg-white/[0.02] transition-colors">
      <td className="px-4 py-3">
        <p className="text-sm font-medium text-foreground">{job.name}</p>
        {job.description && (
          <p className="text-xs text-muted mt-0.5">{job.description}</p>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-muted">{job.schedule}</td>
      <td className="px-4 py-3 text-xs text-muted">
        {job.last_run_at
          ? new Date(job.last_run_at).toLocaleString()
          : "—"}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleToggle}
            aria-label={enabled ? "Disable job" : "Enable job"}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
              enabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                : "bg-white/5 text-muted border-border hover:bg-white/10"
            } disabled:opacity-50`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                enabled ? "bg-emerald-400" : "bg-muted"
              }`}
            />
            {enabled ? "On" : "Off"}
          </button>
          <button
            type="button"
            disabled={runPending}
            onClick={handleRunNow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 border-accent bg-accent/30 text-accent hover:bg-accent/50 disabled:opacity-50"
          >
            {runPending ? "Running…" : "Run now"}
          </button>
        </div>
        {runError && (
          <p className="text-xs text-red-400 mt-1.5 max-w-[280px]">{runError}</p>
        )}
      </td>
    </tr>
  );
}

export function CronJobsSection({ jobs }: { jobs: DbCronJob[] }) {
  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">
          Telegram cron jobs
          <span className="ml-2 text-sm font-normal text-muted">
            Autonomous codebase improvement
          </span>
        </h2>
        <p className="text-xs text-muted max-w-md text-right">
          Scheduled tasks that write to the project Telegram chat. Toggle on/off; Run now works while you are logged into admin (secret is kept in the shared DB).
        </p>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="text-xs text-muted uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Job</th>
              <th className="px-4 py-3 text-left font-medium">Schedule</th>
              <th className="px-4 py-3 text-left font-medium">Last run</th>
              <th className="px-4 py-3 text-left font-medium">Status &amp; Run now</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <CronJobRow key={job.id} job={job} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
