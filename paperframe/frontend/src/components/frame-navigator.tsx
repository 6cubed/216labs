"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface FrameNavigatorProps {
  current: number;
  total: number;
  onChange: (index: number) => void;
}

export default function FrameNavigator({ current, total, onChange }: FrameNavigatorProps) {
  if (total <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <button
        type="button"
        onClick={() => onChange(Math.max(0, current - 1))}
        disabled={current === 0}
        className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-indigo-500/50 disabled:opacity-30 transition-all"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <div className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`
              w-2.5 h-2.5 rounded-full transition-all duration-200
              ${i === current
                ? "bg-indigo-500 scale-125"
                : "bg-[var(--border)] hover:bg-[var(--text-muted)]"
              }
            `}
          />
        ))}
      </div>

      <span className="text-sm text-[var(--text-muted)] font-mono min-w-[80px] text-center">
        Frame {current + 1}/{total}
      </span>

      <button
        type="button"
        onClick={() => onChange(Math.min(total - 1, current + 1))}
        disabled={current === total - 1}
        className="p-2 rounded-lg bg-[var(--surface)] border border-[var(--border)] text-[var(--text-muted)] hover:text-white hover:border-indigo-500/50 disabled:opacity-30 transition-all"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
