import type { ReactNode } from "react";
import type { RevenueReadinessSnapshot } from "@/lib/revenue-readiness";

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
          Live checkout probes plus env keys in this database. After setting Stripe or
          merch keys below, redeploy affected apps (or run{" "}
          <code className="text-[11px]">./deploy.sh</code>). See{" "}
          <code className="text-[11px]">docs/REVENUE-ENV.md</code> in the repo.
        </p>
      </div>

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
