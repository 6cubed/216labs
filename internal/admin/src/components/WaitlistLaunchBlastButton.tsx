"use client";

import { useState } from "react";
import type { StorybookPrintLead } from "@/lib/storybook";

type Props = {
  leads: StorybookPrintLead[];
  priceUsd?: string;
};

export function WaitlistLaunchBlastButton({ leads, priceUsd = "24.99" }: Props) {
  const [copied, setCopied] = useState(false);
  if (leads.length === 0) return null;

  const previewUrl =
    "https://storybook.6cubed.app?utm_source=waitlist_blast&utm_medium=email&utm_campaign=storymagic_launch";
  const subject = "StoryMagic — your printed hardcover is almost ready";
  const body = [
    "Hi there,",
    "",
    "You joined the StoryMagic waitlist — we're opening printed hardcover checkout soon.",
    "",
    `When checkout goes live, you'll be first to know. Printed hardcover: $${priceUsd}.`,
    "",
    "Create a free AI preview while you wait:",
    previewUrl,
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
      window.prompt("Copy launch email:", text);
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs font-semibold text-amber-300 hover:underline"
    >
      {copied ? "Copied launch email" : `Copy launch blast (${leads.length})`}
    </button>
  );
}
