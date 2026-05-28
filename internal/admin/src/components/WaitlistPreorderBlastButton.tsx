"use client";

import { useState } from "react";
import type { StorybookPrintLead } from "@/lib/storybook";

type Props = {
  leads: StorybookPrintLead[];
  preorderUrl: string;
  priceUsd?: string;
};

function withBlastUtm(raw: string): string {
  try {
    const u = new URL(raw);
    u.searchParams.set("utm_source", "waitlist_blast");
    u.searchParams.set("utm_medium", "email");
    u.searchParams.set("utm_campaign", "storymagic_preorder");
    if (!u.searchParams.has("client_reference_id")) {
      u.searchParams.set("client_reference_id", "storymagic_preorder");
    }
    return u.toString();
  } catch {
    return raw;
  }
}

export function WaitlistPreorderBlastButton({ leads, preorderUrl, priceUsd = "24.99" }: Props) {
  const [copied, setCopied] = useState(false);
  if (!preorderUrl.trim() || leads.length === 0) return null;

  const payUrl = withBlastUtm(preorderUrl.trim());
  const subject = `StoryMagic — your printed hardcover is ready ($${priceUsd})`;
  const body = [
    "Hi there,",
    "",
    "You joined the StoryMagic waitlist — checkout is open.",
    "",
    `Preorder your personalised hardcover ($${priceUsd}):`,
    payUrl,
    "",
    "Or create a fresh preview (free):",
    "https://storybook.6cubed.app?utm_source=waitlist_blast&utm_medium=email&utm_campaign=storymagic_preorder",
    "",
    "— 216Labs / StoryMagic",
  ].join("\n");

  const copy = async () => {
    const text = `Subject: ${subject}\n\n${body}\n\n---\nBCC (${leads.length}): ${leads.map((l) => l.email).join(", ")}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy blast email:", text);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs font-semibold text-emerald-300 hover:underline"
    >
      {copied ? "Copied blast email" : `Copy preorder blast (${leads.length})`}
    </button>
  );
}
