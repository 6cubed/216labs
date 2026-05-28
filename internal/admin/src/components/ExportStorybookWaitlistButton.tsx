"use client";

import type { StorybookPrintLead } from "@/lib/storybook";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function ExportStorybookWaitlistButton({ leads }: { leads: StorybookPrintLead[] }) {
  if (leads.length === 0) return null;

  const download = () => {
    const header = [
      "email",
      "book_title",
      "child_name",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "created_at",
    ];
    const rows = leads.map((l) =>
      [
        l.email,
        l.bookTitle,
        l.bookChildName ?? "",
        l.utmSource ?? "",
        l.utmMedium ?? "",
        l.utmCampaign ?? "",
        l.createdAt,
      ]
        .map((c) => csvEscape(String(c)))
        .join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `storymagic-waitlist-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="text-xs font-semibold text-accent hover:underline"
    >
      Export CSV ({leads.length})
    </button>
  );
}
