"use client";

import { mysteries } from "@/data/mysteries";

export function TipForm() {
  return (
    <form
      className="flex flex-col gap-4 text-left"
      onSubmit={(e) => e.preventDefault()}
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Related Case
        </label>
        <select className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent/50">
          <option value="">Select a mystery...</option>
          {mysteries.map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.title}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Your Tip or Information
        </label>
        <textarea
          rows={4}
          placeholder="Describe what you know..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted/50 outline-none focus:border-accent/50 resize-none"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-muted">
          Contact (optional, kept confidential)
        </label>
        <input
          type="email"
          placeholder="your@email.com"
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder-muted/50 outline-none focus:border-accent/50"
        />
      </div>
      <button
        type="submit"
        className="mt-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-background transition-colors hover:bg-amber-400 cursor-pointer"
      >
        Submit Tip
      </button>
    </form>
  );
}
