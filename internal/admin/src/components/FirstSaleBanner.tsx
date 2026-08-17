import Link from "next/link";
import { getAllEnvVars } from "@/lib/db";
import { fetchStorybookPrintLeads, productionWaitlistLeads } from "@/lib/storybook";
import {
  getRevenueReadiness,
  storybookPreorderConfigured,
} from "@/lib/revenue-readiness";

export async function FirstSaleBanner() {
  const envRows = getAllEnvVars();
  const data = await getRevenueReadiness(envRows);
  if (data.allCheckoutReady) return null;

  const envMap = new Map(envRows.map((r) => [r.key, (r.value ?? "").trim()]));
  const preorderLive = storybookPreorderConfigured(envMap);
  const waitlistAll = await fetchStorybookPrintLeads();
  const waitlist = productionWaitlistLeads(waitlistAll);

  if (preorderLive && waitlist.length > 0) {
    return (
      <div className="mb-6 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3">
        <p className="text-sm font-semibold text-emerald-100/95">
          StoryMagic preorder is live
          <span className="font-normal text-muted">
            {" "}
            · {waitlist.length} on waitlist
          </span>
        </p>
        <p className="text-xs text-muted mt-1 max-w-3xl">
          Demand exists — email the waitlist from{" "}
          <Link href="/leads" className="underline text-accent">
            Leads → Copy preorder blast
          </Link>
          .
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <Link href="/leads" className="font-semibold text-accent hover:underline">
            Blast waitlist →
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
      </div>
    );
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-amber-100/95">
        First euro — send /work to one buyer
        {waitlist.length > 0 ? (
          <span className="font-normal text-muted">
            {" "}
            · {waitlist.length} on StoryMagic waitlist
          </span>
        ) : null}
      </p>
      <p className="text-xs text-muted mt-1 max-w-3xl">
        Human visitors last 7 days ≈ 0. A checkout converts a fraction of zero.
        Telegram <code className="text-[11px]">/work</code> (alias{" "}
        <code className="text-[11px]">/firstsale</code>) is the forwardable hire blurb.
        {preorderLive ? " StoryMagic preorder is already live for when traffic exists." : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
        <a
          href="https://6cubed.app/#work"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          Hire form →
        </a>
        <a
          href="https://github.com/6cubed/216labs/tree/main/colabs/carfac-sai-underwater"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-accent hover:underline"
        >
          CARFAC proof →
        </a>
        <Link href="/leads" className="text-muted hover:text-foreground">
          Leads
        </Link>
        <Link href="/checkout-setup" className="text-muted hover:text-foreground">
          Checkout setup (when there is traffic)
        </Link>
      </div>
    </div>
  );
}
