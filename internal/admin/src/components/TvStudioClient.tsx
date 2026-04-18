"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_CHARACTERS,
  DEFAULT_SERIES,
  type GenerateFormat,
  type TvCharacter,
} from "@/lib/tv-studio";

function idsInitial(): string[] {
  return DEFAULT_CHARACTERS.map((c) => c.id);
}

export function TvStudioClient() {
  const [roster, setRoster] = useState<TvCharacter[]>(DEFAULT_CHARACTERS);
  const [selectedIds, setSelectedIds] = useState<string[]>(idsInitial);
  const [episodeTitle, setEpisodeTitle] = useState("");
  const [premise, setPremise] = useState("");
  const [beatNotes, setBeatNotes] = useState("");
  const [format, setFormat] = useState<GenerateFormat>("beat_sheet");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ model?: string; provider?: string } | null>(null);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const toggleCharacter = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(roster.map((c) => c.id));
  }, [roster]);

  const exportRoster = useCallback(() => {
    const blob = new Blob([JSON.stringify(roster, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tv-studio-characters.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [roster]);

  const importRoster = useCallback((file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string) as unknown;
        if (!Array.isArray(parsed)) throw new Error("Expected a JSON array");
        const next: TvCharacter[] = [];
        for (const row of parsed) {
          if (!row || typeof row !== "object") continue;
          const o = row as Record<string, unknown>;
          if (
            typeof o.id === "string" &&
            typeof o.name === "string" &&
            typeof o.role === "string" &&
            typeof o.voice === "string"
          ) {
            next.push({
              id: o.id,
              name: o.name,
              role: o.role,
              voice: o.voice,
              canon: Array.isArray(o.canon) ? o.canon.filter((x) => typeof x === "string") : [],
              constraints: Array.isArray(o.constraints)
                ? o.constraints.filter((x) => typeof x === "string")
                : [],
              relationships:
                o.relationships && typeof o.relationships === "object" && o.relationships !== null
                  ? Object.fromEntries(
                      Object.entries(o.relationships as Record<string, unknown>).filter(
                        ([k, v]) => typeof k === "string" && typeof v === "string"
                      ) as [string, string][]
                    )
                  : {},
            });
          }
        }
        if (next.length === 0) throw new Error("No valid characters found");
        setRoster(next);
        setSelectedIds(next.map((c) => c.id));
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import failed");
      }
    };
    reader.readAsText(file);
  }, []);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setMeta(null);
    setOutput("");
    try {
      const res = await fetch("/api/tv-studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          episodeTitle,
          premise,
          beatNotes,
          characterIds: selectedIds,
          format,
          characters: roster,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        detail?: string;
        text?: string;
        model?: string;
        provider?: string;
      };
      if (!res.ok) {
        setError(data.error || data.detail || `Request failed (${res.status})`);
        return;
      }
      setOutput(data.text ?? "");
      setMeta({ model: data.model, provider: data.provider });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [beatNotes, episodeTitle, format, premise, roster, selectedIds]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <section className="lg:col-span-4 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold text-foreground">Series bible (read-only)</h3>
          <p className="text-xs text-muted mt-2">
            <span className="text-foreground font-medium">{DEFAULT_SERIES.title}</span>
            {" — "}
            {DEFAULT_SERIES.logline}
          </p>
          <ul className="mt-2 text-xs text-muted list-disc pl-4 space-y-1">
            {DEFAULT_SERIES.worldRules.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground">Cast (predefined)</h3>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-accent hover:underline"
            >
              Select all
            </button>
          </div>
          <p className="text-xs text-muted mb-3">
            Grounded mode: the model only gets these bibles. Import JSON to swap the roster for your
            show.
          </p>
          <ul className="space-y-2 max-h-64 overflow-y-auto">
            {roster.map((c) => (
              <li key={c.id}>
                <label className="flex items-start gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    className="mt-1 rounded border-border"
                    checked={selectedSet.has(c.id)}
                    onChange={() => toggleCharacter(c.id)}
                  />
                  <span>
                    <span className="text-foreground font-medium">{c.name}</span>
                    <span className="text-muted"> — {c.role}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={exportRoster}
              className="text-xs px-2 py-1 rounded border border-border text-muted hover:text-foreground"
            >
              Export roster JSON
            </button>
            <label className="text-xs px-2 py-1 rounded border border-border text-muted hover:text-foreground cursor-pointer">
              Import roster
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={(e) => importRoster(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
        </div>
      </section>

      <section className="lg:col-span-4 space-y-4">
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Episode</h3>
          <div>
            <label className="text-xs text-muted">Title</label>
            <input
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={episodeTitle}
              onChange={(e) => setEpisodeTitle(e.target.value)}
              placeholder="e.g. The Permit Paradox"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Premise</label>
            <textarea
              className="mt-1 w-full min-h-[120px] rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={premise}
              onChange={(e) => setPremise(e.target.value)}
              placeholder="What happens this week? Conflict + comic engine."
            />
          </div>
          <div>
            <label className="text-xs text-muted">Optional beats / jokes</label>
            <textarea
              className="mt-1 w-full min-h-[72px] rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={beatNotes}
              onChange={(e) => setBeatNotes(e.target.value)}
              placeholder="Lines to hit, props, callback jokes…"
            />
          </div>
          <div>
            <label className="text-xs text-muted">Output shape</label>
            <select
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground"
              value={format}
              onChange={(e) => setFormat(e.target.value as GenerateFormat)}
            >
              <option value="beat_sheet">Beat sheet (acts + stinger)</option>
              <option value="dialogue_scenes">Dialogue scenes (sluglines + lines)</option>
              <option value="shot_list">Shot list (tiny crew)</option>
            </select>
          </div>
          <button
            type="button"
            disabled={loading || !episodeTitle.trim() || !premise.trim()}
            onClick={generate}
            className="w-full rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-45"
          >
            {loading ? "Generating…" : "Generate grounded draft"}
          </button>
        </div>
      </section>

      <section className="lg:col-span-4">
        <div className="rounded-lg border border-border bg-card p-4 min-h-[320px]">
          <h3 className="text-sm font-semibold text-foreground">Draft</h3>
          {meta?.model ? (
            <p className="text-xs text-muted mt-1">
              {meta.provider} · {meta.model}
            </p>
          ) : null}
          {error ? (
            <p className="text-sm text-rose-400 mt-3 whitespace-pre-wrap">{error}</p>
          ) : output ? (
            <pre className="mt-3 text-xs text-foreground/95 whitespace-pre-wrap font-sans leading-relaxed">
              {output}
            </pre>
          ) : (
            <p className="text-sm text-muted mt-3">
              Generated script beats or dialogue appear here. Keys: prefer{" "}
              <code className="text-foreground/90">OPENROUTER_API_KEY</code> (cheap models) or{" "}
              <code className="text-foreground/90">OPENAI_API_KEY</code> in admin env. Optional{" "}
              <code className="text-foreground/90">ADMIN_TV_STUDIO_MODEL</code> overrides the default
              model.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
