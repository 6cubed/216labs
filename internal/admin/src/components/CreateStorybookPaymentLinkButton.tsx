"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createStorybookPaymentLink } from "@/app/actions";

type Props = {
  priceUsd?: string;
  waitlistFamilies?: number;
};

export function CreateStorybookPaymentLinkButton({
  priceUsd = "24.99",
  waitlistFamilies = 0,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);

  const onClick = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await createStorybookPaymentLink();
      if ("error" in result) {
        setMessage({ ok: false, text: result.error });
        return;
      }
      setCreatedUrl(result.url);
      setMessage({
        ok: true,
        text: result.reloaded
          ? `Payment Link created and saved — recreated ${result.reloaded}`
          : "Payment Link created and saved to Env",
      });
      router.refresh();
    });
  };

  return (
    <div className="rounded-lg border border-emerald-500/35 bg-emerald-500/5 px-3 py-3 space-y-2">
      <p className="text-xs text-muted">
        One click: create a Stripe Payment Link (${priceUsd}), save to Env, and hot-reload StoryMagic.
        Uses <code className="text-[10px]">STORYBOOK_STRIPE_SECRET_KEY</code> from Env.
      </p>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="px-4 py-2 rounded-lg text-xs font-semibold border-2 border-emerald-400/60 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
      >
        {pending ? "Creating…" : `Create Payment Link ($${priceUsd})`}
      </button>
      {message ? (
        <p className={`text-[11px] ${message.ok ? "text-emerald-300" : "text-red-400"}`}>
          {message.text}
        </p>
      ) : null}
      {createdUrl ? (
        <p className="text-[11px] text-muted break-all">
          URL:{" "}
          <a href={createdUrl} target="_blank" rel="noreferrer" className="underline text-accent">
            {createdUrl}
          </a>
        </p>
      ) : null}
      {message?.ok && waitlistFamilies > 0 ? (
        <p className="text-[11px] text-emerald-200">
          Next:{" "}
          <Link href="/leads" className="underline font-semibold text-accent">
            Leads → Copy preorder blast
          </Link>{" "}
          ({waitlistFamilies} email{waitlistFamilies === 1 ? "" : "s"}).
        </p>
      ) : null}
    </div>
  );
}
