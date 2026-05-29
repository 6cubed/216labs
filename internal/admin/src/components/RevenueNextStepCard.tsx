import Link from "next/link";

type Props = {
  checkoutReady: boolean;
  preorderLive: boolean;
  waitlistCount: number;
  /** STORYBOOK_STRIPE_SECRET_KEY in admin Env — enables one-click Payment Link on Checkout setup. */
  stripeSecretSet?: boolean;
};

export function RevenueNextStepCard({
  checkoutReady,
  preorderLive,
  waitlistCount,
  stripeSecretSet = false,
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
        Funnel is live (preview, waitlist, UTMs, landing CTA, referrals). Blocker: enable StoryMagic{" "}
        <strong className="text-foreground/90">preorder</strong>
        {stripeSecretSet
          ? " — open Checkout setup and click Create Payment Link (one click)."
          : " — add STORYBOOK_STRIPE_SECRET_KEY in Env, then Create Payment Link on Checkout setup (~2 min)."}
        {" "}Then Telegram <code className="text-[11px]">/experiment</code> for this week&apos;s post.
        {waitlistCount > 0
          ? ` ${waitlistCount} production waitlist email${waitlistCount === 1 ? "" : "s"}.`
          : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
        <Link href="/checkout-setup" className="text-accent hover:underline">
          {stripeSecretSet ? "Create Payment Link (one click) →" : "Checkout setup →"}
        </Link>
        {!stripeSecretSet ? (
          <Link href="/env" className="text-accent hover:underline">
            Add Stripe secret →
          </Link>
        ) : null}
        <a
          href="https://dashboard.stripe.com/test/payment-links/create"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground"
        >
          Stripe dashboard
        </a>
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
