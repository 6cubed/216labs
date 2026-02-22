"use client";

import { useState, useMemo } from "react";
import { mysteries } from "@/data/mysteries";
import { MysteryCard } from "./MysteryCard";
import type { MysteryStatus, MysteryCategory } from "@/data/types";

const statusOptions: { value: MysteryStatus | "all"; label: string }[] = [
  { value: "all", label: "All Statuses" },
  { value: "unsolved", label: "Unsolved" },
  { value: "cold_case", label: "Cold Case" },
  { value: "partially_solved", label: "Partially Solved" },
  { value: "solved", label: "Solved" },
];

const categoryOptions: { value: MysteryCategory | "all"; label: string }[] = [
  { value: "all", label: "All Categories" },
  { value: "disappearance", label: "Disappearance" },
  { value: "murder", label: "Murder" },
  { value: "unsolved_death", label: "Unsolved Death" },
  { value: "robbery", label: "Robbery" },
];

export function MysteryGrid() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<MysteryStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<MysteryCategory | "all">("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest">("newest");

  const filtered = useMemo(() => {
    let results = mysteries;

    if (query.trim()) {
      const q = query.toLowerCase();
      results = results.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.subtitle.toLowerCase().includes(q) ||
          m.summary.toLowerCase().includes(q) ||
          m.region.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (statusFilter !== "all") {
      results = results.filter((m) => m.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      results = results.filter((m) => m.category === categoryFilter);
    }

    results = [...results].sort((a, b) =>
      sortBy === "newest" ? b.year - a.year : a.year - b.year
    );

    return results;
  }, [query, statusFilter, categoryFilter, sortBy]);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search mysteries, locations, names..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface py-2.5 pl-10 pr-4 text-sm text-foreground placeholder-muted/60 outline-none transition-colors focus:border-accent/50 focus:ring-1 focus:ring-accent/20"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MysteryStatus | "all")}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent/50 cursor-pointer"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as MysteryCategory | "all")}
            className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors focus:border-accent/50 cursor-pointer"
          >
            {categoryOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => setSortBy(sortBy === "newest" ? "oldest" : "newest")}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted transition-colors hover:text-foreground hover:border-accent/30 cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
            </svg>
            {sortBy === "newest" ? "Newest" : "Oldest"}
          </button>
        </div>
      </div>

      <div className="mb-4 text-sm text-muted">
        {filtered.length} {filtered.length === 1 ? "mystery" : "mysteries"} found
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border border-dashed bg-surface/50 py-16">
          <svg className="mb-3 h-10 w-10 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-sm text-muted">No mysteries match your search.</p>
          <button
            onClick={() => { setQuery(""); setStatusFilter("all"); setCategoryFilter("all"); }}
            className="mt-2 text-sm text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m, i) => (
            <div key={m.slug} className="animate-fade-in" style={{ animationDelay: `${i * 50}ms` }}>
              <MysteryCard mystery={m} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
