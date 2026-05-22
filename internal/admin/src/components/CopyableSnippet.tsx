"use client";

import { useState } from "react";

export function CopyableSnippet({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1.5 text-[11px] font-mono text-accent hover:underline"
      title={value}
    >
      {label}
      <span className="text-muted">{copied ? "copied" : "copy"}</span>
    </button>
  );
}
