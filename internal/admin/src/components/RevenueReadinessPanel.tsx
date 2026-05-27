import type { ReactNode } from "react";
import { CopyableSnippet } from "@/components/CopyableSnippet";
import {
  REVENUE_SETUP_LINKS,
  type RevenueReadinessSnapshot,
} from "@/lib/revenue-readiness";

function StatusPill({
  tone,
  children,
}: {
  tone: "ok" | "warn" | "bad" | "muted";
  children: ReactNode;
}) {
  const styles = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warn: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    bad: "bg-red-500/10 text-red-400 border-red-500/20",
    muted: "bg-white/5 text-muted border-border",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

export function RevenueReadinessPanel({
  data,
}: {
  data: RevenueReadinessSnapshot;
}) {
  return (
    <section className="animate-fade-in">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Revenue readiness</h2>
        <p className="text-xs text-muted mt-0.5 max-w-2xl">
          Live checkout probes plus env keys in this database. Saving{" "}
          <code className="text-[11px]">STORYBOOK_*</code> /{" "}
          <code className="text-[11px]">ONEPAGE_*</code> on this host regenerates{" "}
          <code className="text-[11px]">.env.admin</code> and recreates that app
          container (no laptop deploy). See{" "}
          <code className="text-[11px]">docs/FIRST-SALE.md</code>.
        </p>
      </div>

      {!data.allCheckoutReady && (
        <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-medium text-amber-200/95">First sale: add Stripe keys below</p>
          <p className="text-xs text-muted mt-1">
            Edge is up — checkout probes return JSON but{" "}
            <code className="text-[11px]">ready: false</code> until keys are saved.
            StoryMagic needs <strong>secret + webhook</strong> only (publishable optional).
          </p>
          {data.storybookPrintLeadCount != null && data.storybookPrintLeadCount > 0 && (
            <p className="text-xs text-amber-200/80 mt-2">
              <strong>{data.storybookPrintLeadCount}</strong> print-interest lead
              {data.storybookPrintLeadCount === 1 ? "" : "s"} waiting —{" "}
              <a href="/orders" className="text-accent hover:underline">
                view on Orders
              </a>
              . Stripe keys unlock checkout for this waitlist.
            </p>
          )}
        </div>
      )}

      {data.lastCronProbe && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-xs ${
            data.lastCronProbe.issues > 0
              ? "border-red-500/30 bg-red-500/5 text-red-300/90"
              : "border-border bg-white/[0.02] text-muted"
          }`}
        >
          <p className="font-medium text-foreground mb-1">
            Last droplet probe ({data.lastCronProbe.at})
          </p>
          {data.lastCronProbe.issues > 0 ? (
            <ul className="space-y-0.5 font-mono">
              {data.lastCronProbe.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.id}>
                    {r.label}: {r.error || `HTTP ${r.status ?? "?"}`}
                  </li>
                ))}
            </ul>
          ) : (
            <p>All cron probes OK on the VPS (Stripe keys may still be unset).</p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {data.apps.map((app) => {
          const envTone = app.keysReady ? "ok" : "warn";
          let probeTone: "ok" | "warn" | "bad" | "muted" = "muted";
          let probeLabel = "Probe skipped";
          if (app.probeOk === false) {
            probeTone = "bad";
            probeLabel = app.probeError ?? "Unreachable";
          } else if (app.probeOk === true && app.probeReady === true) {
            probeTone = "ok";
            probeLabel = "Checkout ready";
          } else if (app.probeOk === true && app.probeReady === false) {
            probeTone = "warn";
            probeLabel = "Keys or Stripe pending";
          }

          return (
            <div
              key={app.id}
              className="bg-surface border border-border rounded-xl p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    {app.label}
                  </h3>
                  <a
                    href={app.publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-accent hover:underline"
                  >
                    {app.publicUrl.replace("https://", "")}
                  </a>
                </div>
                <StatusPill tone={probeTone}>{probeLabel}</StatusPill>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <StatusPill tone={envTone}>
                  Env {app.keysReady ? "complete" : "incomplete"}
                </StatusPill>
              </div>

              <ul className="text-[11px] text-muted space-y-1 font-mono">
                {app.keys.map((k) => (
                  <li key={k.key} className={k.set ? "text-emerald-400/90" : ""}>
                    {k.set ? "✓" : "○"} {k.key}
                  </li>
                ))}
              </ul>

              {app.probeMessage && (
                <p className="text-[11px] text-muted leading-snug border-t border-border/60 pt-2">
                  {app.probeMessage}
                </p>
              )}
              {app.probeError && (
                <p className="text-[11px] text-red-400/90 leading-snug border-t border-border/60 pt-2">
                  {app.probeError}
                </p>
              )}

              {!app.keysReady && REVENUE_SETUP_LINKS[app.id] && (
                <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
                  {REVENUE_SETUP_LINKS[app.id].stripeDashboard && (
                    <a
                      href={REVENUE_SETUP_LINKS[app.id].stripeDashboard}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-accent hover:underline"
                    >
                      Open Stripe test keys →
                    </a>
                  )}
                  {REVENUE_SETUP_LINKS[app.id].webhookUrl && (
                    <CopyableSnippet
                      label="Webhook URL"
                      value={REVENUE_SETUP_LINKS[app.id].webhookUrl!}
                    />
                  )}
                  {REVENUE_SETUP_LINKS[app.id].deployHint && (
                    <p className="text-[11px] text-muted font-mono leading-snug">
                      {REVENUE_SETUP_LINKS[app.id].deployHint}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {data.allCheckoutReady ? (
        <p className="mt-4 text-sm text-emerald-400">
          All paid checkout probes passed.
        </p>
      ) : (
        <p className="mt-4 text-xs text-muted">
          Leads without Stripe: StoryMagic print-interest on Orders; 1PageResearch
          free requests on <code className="text-[11px]">/generate</code>.
        </p>
      )}
    </section>
  );
}
