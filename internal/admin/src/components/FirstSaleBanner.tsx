import Link from "next/link";
import { getAllEnvVars } from "@/lib/db";
import { fetchStorybookPrintLeads } from "@/lib/storybook";
import {
  getRevenueReadiness,
  STORYBOOK_CHECKOUT_REQUIRED_KEYS,
  storybookPreorderConfigured,
} from "@/lib/revenue-readiness";

export async function FirstSaleBanner() {
  const envRows = getAllEnvVars();
  const data = await getRevenueReadiness(envRows);
  if (data.allCheckoutReady) return null;

  const envMap = new Map(envRows.map((r) => [r.key, (r.value ?? "").trim()]));
  const preorderLive = storybookPreorderConfigured(envMap);
  const waitlist = await fetchStorybookPrintLeads();
  const story = data.apps.find((a) => a.id === "storybook");
  const missing = STORYBOOK_CHECKOUT_REQUIRED_KEYS.filter(
    (key) => !story?.keys.find((k) => k.key === key)?.set
  );

  if (preorderLive) {
    return (
      <div className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-100/95">
          StoryMagic preorder is live (Payment Link)
          {waitlist.length > 0 ? (
            <span className="font-normal text-muted">
              {" "}
              · {waitlist.length} on waitlist
            </span>
          ) : null}
        </p>
        <p className="text-xs text-muted mt-1 max-w-3xl">
          Visitors see <strong>Preorder now</strong> on the preview page. Add Stripe webhook keys on{" "}
          <Link href="/checkout-setup" className="underline text-accent">
            Checkout setup
          </Link>{" "}
          when you want in-app checkout and paid rows in Orders.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link href="/checkout-setup" className="font-semibold text-accent hover:underline">
            Checkout setup →
          </Link>
          <a
            href="https://storybook.6cubed.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted hover:text-foreground"
          >
            Test StoryMagic
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-amber-100/95">
        First sale — StoryMagic checkout is one Env save away
        {waitlist.length > 0 ? (
          <span className="font-normal text-muted">
            {" "}
            · {waitlist.length} on waitlist
          </span>
        ) : null}
      </p>
      <p className="text-xs text-muted mt-1 max-w-3xl">
        Edge is up; probes return JSON with <code className="text-[11px]">ready: false</code> until
        Add Stripe <strong>test</strong> secret + webhook signing secret (2 keys), or set{" "}
        <code className="text-[11px]">NEXT_PUBLIC_STORYBOOK_PREORDER_URL</code> for a Payment Link preorder button on StoryMagic.
        Saving <code className="text-[11px]">STORYBOOK_*</code> hot-reloads storybook on this host.
      </p>
      {missing.length > 0 && (
        <p className="text-[11px] font-mono text-amber-200/80 mt-2">
          Missing: {missing.join(", ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <Link
          href="/checkout-setup"
          className="font-semibold text-accent hover:underline"
        >
          Checkout setup →
        </Link>
        <Link
          href="/env"
          className="font-semibold text-accent hover:underline"
        >
          Open Env →
        </Link>
        <a
          href="https://dashboard.stripe.com/test/apikeys"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          Stripe test keys
        </a>
        <a
          href="https://storybook.6cubed.app"
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted hover:text-foreground"
        >
          Try StoryMagic
        </a>
      </div>
    </div>
  );
}
