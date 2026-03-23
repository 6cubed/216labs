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

/** Extract env key prefixes for grouping (scale: no hardcoded app list). */
function getPrefixes(keys: string[]): string[] {
  const prefixes = new Set<string>();
  for (const key of keys) {
    const segs = key.split("_").filter(Boolean);
    if (segs.length >= 1) prefixes.add(segs[0] + "_");
    if (key.startsWith("NEXT_PUBLIC_") && segs.length >= 2)
      prefixes.add("NEXT_PUBLIC_" + segs[1] + "_");
  }
  return Array.from(prefixes).sort((a, b) => b.length - a.length);
}

export function EnvVarEditor({ vars }: { vars: EnvVarRow[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const prefixes = getPrefixes(vars.map((v) => v.key));
    const result: Record<string, EnvVarRow[]> = { _other: [] };
    for (const p of prefixes) result[p] = [];
    for (const v of vars) {
      const prefix = prefixes.find((p) => v.key.startsWith(p));
      if (prefix) result[prefix].push(v);
      else result._other.push(v);
    }
    return result;
  }, [vars]);

  const groupOrder = useMemo(() => {
    const prefixes = getPrefixes(vars.map((v) => v.key));
    return [...prefixes, "_other"];
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
        {groupOrder.map((key) => {
          const rows = grouped[key] ?? [];
          const title =
            key === "_other"
              ? "Shared / Other"
              : key.replace(/_$/, "").replace(/_/g, " ");
          return renderGroup(title, rows);
        })}
      </div>
    </section>
  );
}
