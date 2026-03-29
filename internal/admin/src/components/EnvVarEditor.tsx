"use client";

import { useMemo, useState, useTransition } from "react";
import { saveEnvVar } from "@/app/actions";
import {
  ENV_UI_CATEGORY_HINT,
  ENV_UI_CATEGORY_LABEL,
  ENV_UI_CATEGORY_ORDER,
  classifyEnvKey,
  type EnvUiCategoryId,
} from "@/lib/env-ui-buckets";

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

function normalizeQuery(q: string) {
  return q.trim().toLowerCase();
}

export function EnvVarEditor({ vars }: { vars: EnvVarRow[] }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openCats, setOpenCats] = useState<Record<EnvUiCategoryId, boolean>>(() => ({
    platform: true,
    deploy: true,
    telegram: true,
    analytics: true,
    openai_overrides: false,
    app_other: false,
  }));

  const filtered = useMemo(() => {
    const nq = normalizeQuery(query);
    if (!nq) return vars;
    return vars.filter(
      (v) =>
        v.key.toLowerCase().includes(nq) ||
        v.description.toLowerCase().includes(nq) ||
        (v.value && v.value.toLowerCase().includes(nq) && !v.is_secret)
    );
  }, [vars, query]);

  const buckets = useMemo(() => {
    const byCat: Record<EnvUiCategoryId, EnvVarRow[]> = {
      platform: [],
      deploy: [],
      telegram: [],
      analytics: [],
      openai_overrides: [],
      app_other: [],
    };
    const appSub: Record<string, EnvVarRow[]> = {};

    for (const row of filtered) {
      const { category, subKey } = classifyEnvKey(row.key);
      if (category === "app_other") {
        const sk = subKey ?? "_other";
        if (!appSub[sk]) appSub[sk] = [];
        appSub[sk].push(row);
      } else {
        byCat[category].push(row);
      }
    }

    const appKeys = Object.keys(appSub).sort((a, b) => {
      if (a === "_other") return 1;
      if (b === "_other") return -1;
      return a.localeCompare(b);
    });

    return { byCat, appSub, appKeys };
  }, [filtered]);

  const toggleCat = (id: EnvUiCategoryId) =>
    setOpenCats((prev) => ({ ...prev, [id]: !prev[id] }));

  const expandAll = () =>
    setOpenCats({
      platform: true,
      deploy: true,
      telegram: true,
      analytics: true,
      openai_overrides: true,
      app_other: true,
    });

  const collapseAll = () =>
    setOpenCats({
      platform: false,
      deploy: false,
      telegram: false,
      analytics: false,
      openai_overrides: false,
      app_other: false,
    });

  const renderRow = (row: EnvVarRow) => {
    const draft = drafts[row.key] ?? row.value;
    const hasChanged = draft !== row.value;
    return (
      <div key={row.key} className="rounded-lg border border-white/5 p-3">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-xs font-mono text-foreground">{row.key}</p>
            <p className="text-xs text-muted">{row.description}</p>
          </div>
          <span className="text-[11px] text-muted shrink-0">
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
  };

  const renderCategory = (id: EnvUiCategoryId) => {
    const rows = buckets.byCat[id];
    if (!rows.length) return null;
    const isOpen = openCats[id];
    return (
      <div key={id} className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleCat(id)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {ENV_UI_CATEGORY_LABEL[id]}
              <span className="ml-2 text-xs font-normal text-muted">
                ({rows.length})
              </span>
            </h3>
            <p className="text-[11px] text-muted mt-0.5 pr-4">
              {ENV_UI_CATEGORY_HINT[id]}
            </p>
          </div>
          <span className="text-muted text-sm shrink-0">{isOpen ? "▼" : "▶"}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 space-y-3 border-t border-border/60 pt-3">
            {rows.map((row) => renderRow(row))}
          </div>
        )}
      </div>
    );
  };

  const renderAppOther = () => {
    const keys = buckets.appKeys;
    if (keys.length === 0) return null;
    const isOpen = openCats.app_other;
    let total = 0;
    for (const k of keys) total += buckets.appSub[k]?.length ?? 0;

    return (
      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => toggleCat("app_other")}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/[0.03] transition-colors"
        >
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {ENV_UI_CATEGORY_LABEL.app_other}
              <span className="ml-2 text-xs font-normal text-muted">({total})</span>
            </h3>
            <p className="text-[11px] text-muted mt-0.5 pr-4">
              {ENV_UI_CATEGORY_HINT.app_other}
            </p>
          </div>
          <span className="text-muted text-sm shrink-0">{isOpen ? "▼" : "▶"}</span>
        </button>
        {isOpen && (
          <div className="px-4 pb-4 space-y-4 border-t border-border/60 pt-3">
            {keys.map((slug) => {
              const subRows = buckets.appSub[slug] ?? [];
              if (subRows.length === 0) return null;
              const label =
                slug === "_other" ? "Unprefixed / misc" : `${slug}…`;
              return (
                <div key={slug}>
                  <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
                    {label}{" "}
                    <span className="font-normal">({subRows.length})</span>
                  </h4>
                  <div className="space-y-3">{subRows.map((row) => renderRow(row))}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Environment variables</h2>
          <p className="text-xs text-muted mt-0.5">
            Stored in SQLite; deploy merges non-empty values into compose via <code className="text-[11px]">.env.admin</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by key or description…"
            className="min-w-[200px] flex-1 rounded-md border border-border bg-black/20 px-3 py-2 text-xs text-foreground outline-none focus:border-accent"
          />
          <button
            type="button"
            onClick={expandAll}
            className="rounded-md border border-border px-2 py-2 text-[11px] text-muted hover:text-foreground"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={collapseAll}
            className="rounded-md border border-border px-2 py-2 text-[11px] text-muted hover:text-foreground"
          >
            Collapse all
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {ENV_UI_CATEGORY_ORDER.filter((id) => id !== "app_other").map((id) =>
          renderCategory(id)
        )}
        {renderAppOther()}
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted mt-6">No keys match your filter.</p>
      )}
    </section>
  );
}
