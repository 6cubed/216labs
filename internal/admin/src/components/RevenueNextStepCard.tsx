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
}: Props) {
  if (checkoutReady) return null;

  if (preorderLive && waitlistCount > 0) {
    return (
      <section className="animate-fade-in mb-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-5 py-4">
        <h2 className="text-sm font-semibold text-emerald-100">StoryMagic — demand to convert</h2>
        <p className="text-xs text-muted mt-1 max-w-3xl">
          Preorder is live and {waitlistCount} waitlist email
          {waitlistCount === 1 ? "" : "s"} can be blasted.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
          <Link href="/leads" className="text-accent hover:underline">
            Copy preorder blast →
          </Link>
          <a
            href="https://6cubed.app/#work"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            Hire form
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-fade-in mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-5 py-4">
      <h2 className="text-sm font-semibold text-amber-100">
        Closest to revenue: one hire, not a Payment Link
      </h2>
      <p className="text-xs text-muted mt-1 max-w-3xl">
        Humans last 7 days ≈ 0. Send Telegram <code className="text-[11px]">/work</code> to one
        buyer — production web / AI retainer / CARFAC audio-ML pilot.
        {preorderLive
          ? " StoryMagic preorder is already live; it cannot convert traffic you do not have."
          : " Checkout plumbing is a 20-minute task for when there is traffic."}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-semibold">
        <a
          href="https://6cubed.app/#work"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Hire form →
        </a>
        <a
          href="https://blog.6cubed.app/blog/carfac-underwater-sai"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          CARFAC proof →
        </a>
        <Link href="/leads" className="text-muted hover:text-foreground">
          Leads
        </Link>
        <Link href="/checkout-setup" className="text-muted hover:text-foreground">
          Checkout setup
        </Link>
      </div>
    </section>
  );
}
