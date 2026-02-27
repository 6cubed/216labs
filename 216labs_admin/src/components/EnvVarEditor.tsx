"use client";

import { useMemo, useState, useTransition } from "react";
import { saveEnvVar } from "@/app/actions";

type EnvVarRow = {
  key: string;
  value: string;
  description: string;
  is_secret: number;
  updated_at: string | null;
};

function maskValue(value: string) {
  if (!value) return "Not set";
  if (value.length <= 6) return "******";
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

const APP_PREFIXES = [
  "ONEROOM_",
  "ONEFIT_",
  "AGIMEMES_",
  "PIPESECURE_",
  "PRIORS_",
  "AGITSHIRTS_",
] as const;

export function EnvVarEditor({ vars }: { vars: EnvVarRow[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const isKnown = (key: string) => APP_PREFIXES.some((p) => key.startsWith(p));
    return {
      oneroom: vars.filter((v) => v.key.startsWith("ONEROOM_")),
      onefit: vars.filter((v) => v.key.startsWith("ONEFIT_")),
      agimemes: vars.filter((v) => v.key.startsWith("AGIMEMES_")),
      pipesecure: vars.filter((v) => v.key.startsWith("PIPESECURE_")),
      priors: vars.filter((v) => v.key.startsWith("PRIORS_")),
      agitshirts: vars.filter((v) => v.key.startsWith("AGITSHIRTS_")),
      shared: vars.filter((v) => !isKnown(v.key)),
    };
  }, [vars]);

  const renderGroup = (title: string, rows: EnvVarRow[]) => {
    if (rows.length === 0) return null;
    return (
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
        <div className="space-y-3">
          {rows.map((row) => {
            const draft = drafts[row.key] ?? row.value;
            const hasChanged = draft !== row.value;
            return (
              <div key={row.key} className="rounded-lg border border-white/5 p-3">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs font-mono text-foreground">{row.key}</p>
                    <p className="text-xs text-muted">{row.description}</p>
                  </div>
                  <span className="text-[11px] text-muted">
                    {row.is_secret ? maskValue(row.value) : row.value || "Not set"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <input
                    type={row.is_secret ? "password" : "text"}
                    value={draft}
                    onChange={(e) =>
                      setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))
                    }
                    placeholder={row.is_secret ? "Set secret value" : "Set value"}
                    className="flex-1 rounded-md border border-border bg-black/20 px-3 py-2 text-xs text-foreground outline-none focus:border-accent"
                  />
                  <button
                    type="button"
                    disabled={!hasChanged || isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await saveEnvVar(row.key, draft);
                        // Clear the draft so the input reverts to the fresh server value
                        // after revalidatePath re-renders the page with the new row.value.
                        setDrafts((prev) => {
                          const next = { ...prev };
                          delete next[row.key];
                          return next;
                        });
                        setSavedKey(row.key);
                        setTimeout(
                          () => setSavedKey((s) => (s === row.key ? null : s)),
                          1500
                        );
                      })
                    }
                    className="rounded-md border border-accent/40 px-3 py-2 text-xs text-accent disabled:opacity-40"
                  >
                    Save
                  </button>
                </div>
                {savedKey === row.key && (
                  <p className="mt-1 text-[11px] text-emerald-400">Saved</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <section className="animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Environment Variables</h2>
        <p className="text-xs text-muted">
          Values are stored in SQLite and applied during deploy.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderGroup("OneRoom", grouped.oneroom)}
        {renderGroup("OneFit", grouped.onefit)}
        {renderGroup("AGI Memes", grouped.agimemes)}
        {renderGroup("PipeSecure", grouped.pipesecure)}
        {renderGroup("Priors", grouped.priors)}
        {renderGroup("AgitShirts", grouped.agitshirts)}
        {renderGroup("Shared", grouped.shared)}
      </div>
    </section>
  );
}
