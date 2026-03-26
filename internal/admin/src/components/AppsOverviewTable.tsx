"use client";

import { categoryLabels, type AppInfo } from "@/data/apps";
import { useMemo, useState, useTransition, useEffect } from "react";
import { DeployToggle } from "./DeployToggle";
import { fetchAppLogs, pullLatestImageAction } from "@/app/actions";
import { canPullGhcrFromAdmin } from "@/lib/ghcr-pull";

const APP_HOST = process.env.NEXT_PUBLIC_APP_HOST || "";

function appUrl(appId: string): string | null {
  if (!APP_HOST || APP_HOST === "localhost") return null;
  return `https://${appId}.${APP_HOST}`;
}

function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = iso.includes("T") ? new Date(iso) : new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSize(mb: number): string {
  if (mb >= 1000) return `${(mb / 1000).toFixed(1)} GB`;
  return `${Math.round(mb)} MB`;
}

function LogsCell({ appId }: { appId: string }) {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (open && lines === null) {
      startTransition(async () => {
        const next = await fetchAppLogs(appId);
        setLines(next);
      });
    }
  }, [open, lines, appId]);

  const refresh = () => {
    startTransition(async () => {
      const next = await fetchAppLogs(appId);
      setLines(next);
    });
  };

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
      className="text-left"
    >
      <summary className="cursor-pointer text-[11px] font-mono text-muted hover:text-foreground list-none select-none">
        <span className="text-accent/80">logs</span>
      </summary>
      <div className="mt-2 rounded-lg border border-white/10 bg-black/40 p-2 max-w-md max-h-48 overflow-y-auto">
        <div className="flex justify-end mb-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              refresh();
            }}
            disabled={isPending}
            className="text-[10px] font-mono text-muted hover:text-foreground disabled:opacity-40"
          >
            {isPending ? "…" : "↻"}
          </button>
        </div>
        {isPending && lines === null ? (
          <p className="text-[10px] text-muted font-mono">Loading…</p>
        ) : lines && lines.length > 0 ? (
          <pre className="text-[10px] leading-relaxed font-mono text-muted/80 whitespace-pre-wrap break-all">
            {lines.join("\n")}
          </pre>
        ) : (
          <p className="text-[10px] text-muted font-mono">No logs.</p>
        )}
      </div>
    </details>
  );
}

function PullLatestCell({
  appId,
  dockerService,
  deployOn,
  isRunning,
}: {
  appId: string;
  dockerService: string;
  deployOn: boolean;
  isRunning: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const allowed = canPullGhcrFromAdmin(dockerService);

  if (!allowed) {
    return (
      <span className="text-[11px] text-muted" title="Edge services use full deploy">
        —
      </span>
    );
  }

  const run = () => {
    setMsg(null);
    startTransition(async () => {
      const r = await pullLatestImageAction(appId);
      if (r && "error" in r && r.error) {
        setMsg(r.error);
      } else {
        setMsg("Updated from GHCR.");
        setTimeout(() => setMsg(null), 4000);
      }
    });
  };

  const disabled = !deployOn || !isRunning || isPending;

  return (
    <div className="text-left min-w-[7rem]">
      <button
        type="button"
        onClick={run}
        disabled={disabled}
        title={
          !deployOn
            ? "Turn deploy on first"
            : !isRunning
              ? "Start the container first"
              : "Pull ghcr.io …:latest, retag, recreate this service"
        }
        className="text-[11px] font-mono rounded-md border border-white/15 bg-white/5 px-2 py-1 text-foreground hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? "…" : "Pull latest"}
      </button>
      {msg && (
        <p
          className={`mt-1 text-[10px] font-mono ${msg.startsWith("Updated") ? "text-emerald-400/90" : "text-amber-400/90"}`}
        >
          {msg.length > 120 ? `${msg.slice(0, 120)}…` : msg}
        </p>
      )}
    </div>
  );
}

export function AppsOverviewTable({
  apps,
  runningServiceNames,
}: {
  apps: AppInfo[];
  runningServiceNames: string[];
}) {
  const running = useMemo(
    () => new Set(runningServiceNames),
    [runningServiceNames]
  );
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return apps;
    return apps.filter(
      (a) =>
        a.name.toLowerCase().includes(s) ||
        a.id.toLowerCase().includes(s) ||
        a.directory.toLowerCase().includes(s) ||
        a.category.toLowerCase().includes(s)
    );
  }, [apps, q]);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-b border-border bg-surface-light/50">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            All applications
          </h2>
          <p className="text-[11px] text-muted mt-0.5">
            {filtered.length === apps.length
              ? `${apps.length} rows · search by name, id, or path`
              : `${filtered.length} of ${apps.length} matching “${q.trim()}”`}
          </p>
        </div>
        <label className="block w-full sm:w-72">
          <span className="sr-only">Filter</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter…"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-accent/50"
          />
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[980px]">
          <thead>
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Application</th>
              <th className="px-4 py-3 font-medium">Port</th>
              <th className="px-4 py-3 font-medium">Path</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Deploy</th>
              <th className="px-4 py-3 font-medium">Runtime</th>
              <th className="px-4 py-3 font-medium">Last deploy</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Open</th>
              <th className="px-4 py-3 font-medium">Logs</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((app) => {
              const isRunning = running.has(app.dockerService);
              const url = appUrl(app.id);
              const deployOn = app.deployEnabled || app.id === "admin";
              return (
                <tr
                  key={app.id}
                  className="border-b border-border/80 hover:bg-white/[0.02] align-top"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{app.name}</div>
                    <div className="text-[11px] font-mono text-muted mt-0.5">
                      {app.id}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {app.port}
                  </td>
                  <td
                    className="px-4 py-3 text-xs text-muted max-w-[220px] truncate font-mono"
                    title={app.directory}
                  >
                    {app.directory}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">
                    {categoryLabels[app.category] ?? app.category}
                  </td>
                  <td className="px-4 py-3">
                    <DeployToggle appId={app.id} deployEnabled={deployOn} />
                  </td>
                  <td className="px-4 py-3 align-top">
                    <PullLatestCell
                      appId={app.id}
                      dockerService={app.dockerService}
                      deployOn={deployOn}
                      isRunning={isRunning}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                        isRunning
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                          : "border-white/10 bg-white/5 text-muted"
                      }`}
                    >
                      {isRunning ? "Running" : "Stopped"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted whitespace-nowrap">
                    {formatShortDate(app.lastDeployedAt)}
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted whitespace-nowrap">
                    {formatSize(app.imageSizeMB)}
                  </td>
                  <td className="px-4 py-3">
                    {url && isRunning ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-accent hover:underline"
                      >
                        Visit
                      </a>
                    ) : url ? (
                      <span
                        className="text-xs text-muted"
                        title="Service not running"
                      >
                        —
                      </span>
                    ) : (
                      <span className="text-xs text-muted" title="Local / no host">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <LogsCell appId={app.id} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (
        <p className="px-4 py-8 text-center text-sm text-muted">
          No applications match this filter.
        </p>
      )}
    </div>
  );
}
