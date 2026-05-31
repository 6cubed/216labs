"use client";

import { useEffect, useState } from "react";
import {
  type CheckoutReady,
  merchStorymagicHref,
  merchStorymagicPreviewHref,
} from "@/lib/storymagic-checkout";

const CHECKOUT_READY_URL = "https://storybook.6cubed.app/api/checkout/ready";

const linkClass =
  "inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 font-medium text-zinc-100 transition-colors";

export default function MerchFeaturedCheckout() {
  const [checkout, setCheckout] = useState<CheckoutReady | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(CHECKOUT_READY_URL)
      .then((r) => r.json())
      .then((data: CheckoutReady) => {
        if (!cancelled) setCheckout(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const preorderLive = Boolean(
    checkout?.preorderConfigured && checkout.preorderUrl?.trim()
  );
  const price = checkout?.priceUsd ?? "24.99";
  const storyHref = preorderLive
    ? merchStorymagicHref(checkout!.preorderUrl!.trim(), "featured_preorder")
    : merchStorymagicPreviewHref("featured");
  const storyLabel = preorderLive
    ? `Preorder StoryMagic — $${price}`
    : "StoryMagic books (preview + waitlist)";

  return (
    <section
      className="mb-10 rounded-2xl border border-fuchsia-500/25 bg-gradient-to-br from-fuchsia-950/40 to-cyan-950/30 p-5 sm:p-6"
      aria-label="Paid products from 216Labs"
    >
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-fuchsia-200/90">
          Checkout live now
        </h2>
        {preorderLive ? (
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border border-emerald-500/35 bg-emerald-500/15 text-emerald-300">
            Preorder live
          </span>
        ) : null}
      </div>
      <p className="text-sm text-[var(--muted)] leading-relaxed max-w-2xl mb-4">
        {preorderLive
          ? "StoryMagic hardcover preorder is open — pay via Stripe Payment Link. Apparel Buy buttons still route to StoryMagic until a Printful storefront URL is set in admin."
          : "Want to support the project today? Paid digital products ship now; apparel Buy buttons route to StoryMagic until a storefront URL is configured."}
      </p>
      <ul className="flex flex-col sm:flex-row flex-wrap gap-3 text-sm">
        <li>
          <a
            href={storyHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} hover:border-cyan-500/40 hover:text-cyan-200`}
          >
            {storyLabel}
          </a>
        </li>
        <li>
          <a
            href="https://1pageresearch.6cubed.app?utm_source=merch&utm_medium=featured"
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} hover:border-fuchsia-500/40 hover:text-fuchsia-200`}
          >
            1PageResearch reports
          </a>
        </li>
      </ul>
    </section>
  );
}
