import Link from "next/link";

type Props = {
  checkoutReady: boolean;
  preorderLive: boolean;
  waitlistCount: number;
};

export function RevenueNextStepCard({
  checkoutReady,
  preorderLive,
  waitlistCount,
}: Props) {
  if (checkoutReady) return null;

  if (preorderLive) {
    return (
      <section className="animate-fade-in mb-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-emerald-100">StoryMagic — preorder live</h2>
        <p className="text-xs text-muted mt-1 max-w-3xl">
          Payment Link is active on StoryMagic and{" "}
          <a
            href="https://6cubed.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-accent"
          >
            6cubed.app
          </a>
          .
          {waitlistCount > 0
            ? ` ${waitlistCount} waitlist email${waitlistCount === 1 ? "" : "s"} ready to convert.`
            : " Drive traffic — GA4 tracks preorder_click."}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
          {waitlistCount > 0 ? (
            <Link href="/leads" className="text-accent hover:underline">
              Copy preorder blast →
            </Link>
          ) : null}
          <a
            href="https://storybook.6cubed.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            Test checkout flow
          </a>
          <Link href="/checkout-setup" className="text-muted hover:text-foreground">
            Checkout setup
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-5 py-4">
      <h2 className="text-sm font-semibold text-amber-100">
        Closest to revenue: StoryMagic ($24.99 hardcover)
      </h2>
        <p className="text-xs text-muted mt-1 max-w-3xl">
        Funnel is live (preview, waitlist, UTMs, landing CTA, referrals). Blocker: paste a Stripe{" "}
        <strong className="text-foreground/90">Payment Link</strong> (~2 min). Then Telegram{" "}
        <code className="text-[11px]">/experiment</code> for this week&apos;s tracked post URL.
        {waitlistCount > 0
          ? ` ${waitlistCount} famil${waitlistCount === 1 ? "y" : "ies"} already on the waitlist.`
          : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
        <a
          href="https://dashboard.stripe.com/test/payment-links/create"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Create Payment Link →
        </a>
        <Link href="/checkout-setup" className="text-accent hover:underline">
          Paste on Checkout setup →
        </Link>
        {waitlistCount > 0 ? (
          <Link href="/leads" className="text-muted hover:text-foreground">
            View waitlist ({waitlistCount})
          </Link>
        ) : null}
        <a
          href="https://storybook.6cubed.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground"
        >
          StoryMagic
        </a>
      </div>
    </section>
  );
}
