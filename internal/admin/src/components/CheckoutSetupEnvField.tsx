"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { saveEnvVar } from "@/app/actions";

type Props = {
  envKey: string;
  initialValue: string;
  label: string;
  placeholder?: string;
  hint?: string;
  /** Button label after save (service hot-reload hint). */
  saveLabel?: string;
  /** Shown after preorder URL save — blast nudge. */
  waitlistFamilies?: number;
};

export function CheckoutSetupEnvField({
  envKey,
  initialValue,
  label,
  placeholder,
  hint,
  saveLabel = "Save & reload StoryMagic",
  waitlistFamilies = 0,
}: Props) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const trimmed = value.trim();
  const stripeLinkWarning =
    envKey === "NEXT_PUBLIC_STORYBOOK_PREORDER_URL" &&
    trimmed &&
    !/^https:\/\/(buy\.stripe\.com|checkout\.stripe\.com)\//i.test(trimmed);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await saveEnvVar(envKey, trimmed);
      if (result && "error" in result) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      const reloaded =
        result && "reloaded" in result && result.reloaded
          ? ` — recreated ${result.reloaded}`
          : "";
      setMessage({ ok: true, text: `Saved${reloaded}` });
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label className="block text-xs font-semibold text-foreground">{label}</label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="url"
          name={envKey}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder ?? "https://buy.stripe.com/…"}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 px-4 py-2 rounded-lg text-xs font-semibold border-2 border-accent bg-accent/30 text-accent hover:bg-accent/50 disabled:opacity-50"
        >
          {pending ? "Saving…" : saveLabel}
        </button>
      </div>
      {hint ? <p className="text-[11px] text-muted">{hint}</p> : null}
      {stripeLinkWarning ? (
        <p className="text-[11px] text-amber-300">
          This does not look like a Stripe Payment Link (
          <code className="text-[10px]">https://buy.stripe.com/…</code>). Double-check before Save.
        </p>
      ) : null}
      {message ? (
        <p className={`text-[11px] ${message.ok ? "text-emerald-300" : "text-red-400"}`}>
          {message.text}
        </p>
      ) : null}
      {message?.ok &&
      envKey === "NEXT_PUBLIC_STORYBOOK_PREORDER_URL" &&
      value.trim() ? (
        <p className="text-[11px] text-emerald-200">
          Preorder is live.{" "}
          {waitlistFamilies > 0 ? (
            <>
              Next:{" "}
              <Link href="/leads" className="underline font-semibold text-accent">
                Leads → Copy preorder blast
              </Link>{" "}
              ({waitlistFamilies} email{waitlistFamilies === 1 ? "" : "s"}).
            </>
          ) : (
            <>
              Share{" "}
              <a
                href="https://storybook.6cubed.app"
                target="_blank"
                rel="noreferrer"
                className="underline text-accent"
              >
                StoryMagic
              </a>{" "}
              or run the week experiment (<code className="text-[10px]">/experiment</code>).
            </>
          )}
        </p>
      ) : null}
      <code className="text-[10px] text-muted block">{envKey}</code>
    </form>
  );
}
