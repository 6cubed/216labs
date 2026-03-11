"use client";

import { TimelineEvent } from "@/data/types";
import { useState } from "react";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <div className="relative">
      <div className="absolute left-[19px] top-2 bottom-2 w-px bg-gradient-to-b from-accent via-border to-border" />

      <ol className="space-y-0">
        {events.map((event, i) => {
          const isExpanded = expandedIndex === i;
          return (
            <li key={i} className="relative pl-12">
              <div className="absolute left-0 top-3 flex h-10 w-10 items-center justify-center">
                <div
                  className={`h-3 w-3 rounded-full border-2 transition-colors ${
                    i === 0
                      ? "border-accent bg-accent shadow-sm shadow-accent/30"
                      : "border-border bg-surface-light"
                  }`}
                />
              </div>

              <button
                onClick={() => setExpandedIndex(isExpanded ? null : i)}
                className="w-full cursor-pointer rounded-lg p-4 text-left transition-colors hover:bg-surface-light group"
              >
                <div className="mb-1 flex items-start justify-between gap-4">
                  <time className="shrink-0 font-mono text-xs text-accent/80">
                    {event.date}
                  </time>
                  <svg
                    className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <h4 className="text-sm font-semibold text-foreground group-hover:text-accent transition-colors">
                  {event.title}
                </h4>

                {isExpanded && (
                  <div className="mt-2 animate-fade-in">
                    <p className="text-sm leading-relaxed text-muted">
                      {event.description}
                    </p>
                    {event.source && (
                      <p className="mt-2 text-xs text-muted/60">
                        Source: {event.source}
                      </p>
                    )}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
