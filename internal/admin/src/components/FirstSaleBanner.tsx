import Link from "next/link";
import { getAllEnvVars } from "@/lib/db";
import { getRevenueReadiness } from "@/lib/revenue-readiness";

export async function FirstSaleBanner() {
  const data = await getRevenueReadiness(getAllEnvVars());
  if (data.allCheckoutReady) return null;

  const story = data.apps.find((a) => a.id === "storybook");
  const missing =
    story?.keys.filter((k) => !k.set).map((k) => k.key) ?? [];

  return (
    <div className="mb-6 rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3">
      <p className="text-sm font-semibold text-amber-100/95">
        First sale — StoryMagic checkout is one Env save away
      </p>
      <p className="text-xs text-muted mt-1 max-w-3xl">
        Edge is up; probes return JSON with <code className="text-[11px]">ready: false</code> until
        Stripe test keys are saved. Saving <code className="text-[11px]">STORYBOOK_*</code>{" "}
        hot-reloads the storybook container on this host.
      </p>
      {missing.length > 0 && (
        <p className="text-[11px] font-mono text-amber-200/80 mt-2">
          Missing: {missing.join(", ")}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-3 text-xs">
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
