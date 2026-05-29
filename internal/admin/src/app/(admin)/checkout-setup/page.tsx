import Link from "next/link";
import { getAllEnvVars } from "@/lib/db";
import { CheckoutSetupEnvField } from "@/components/CheckoutSetupEnvField";
import { RunRevenueProbeButton } from "@/components/RunRevenueProbeButton";
import {
  REVENUE_APPS,
  REVENUE_SETUP_LINKS,
  STORYBOOK_CHECKOUT_REQUIRED_KEYS,
  STORYBOOK_STRIPE_WEBHOOK_EVENTS,
  merchStorefrontLiveFromHtml,
} from "@/lib/revenue-readiness";
import { fetchStorybookPrintLeads } from "@/lib/storybook";

export const dynamic = "force-dynamic";

function isSet(env: Map<string, string>, key: string): boolean {
  return Boolean(env.get(key)?.trim());
}

type CheckoutProbe = {
  ok: boolean;
  ready: boolean;
  preorderConfigured?: boolean;
  priceUsd?: string;
  waitlistCount?: number;
  missingKeys?: string[];
  error?: string;
};

async function probeStorybookCheckout(url: string): Promise<CheckoutProbe> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      ready?: boolean;
      preorderConfigured?: boolean;
      priceUsd?: string;
      waitlistCount?: number;
      missingKeys?: string[];
    };
    return {
      ok: res.ok,
      ready: Boolean(data.ready),
      preorderConfigured: Boolean(data.preorderConfigured),
      priceUsd: data.priceUsd,
      waitlistCount:
        typeof data.waitlistCount === "number" ? data.waitlistCount : undefined,
      missingKeys: data.missingKeys,
    };
  } catch (e) {
    return { ok: false, ready: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function probeGenericCheckout(url: string): Promise<CheckoutProbe> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    const data = (await res.json()) as {
      ready?: boolean;
      priceUsd?: string;
      missingKeys?: string[];
    };
    return {
      ok: res.ok,
      ready: Boolean(data.ready),
      priceUsd: typeof data.priceUsd === "string" ? data.priceUsd : undefined,
      missingKeys: Array.isArray(data.missingKeys) ? data.missingKeys : undefined,
    };
  } catch (e) {
    return { ok: false, ready: false, error: e instanceof Error ? e.message : "fetch failed" };
  }
}

async function probeMerchPage(url: string): Promise<{ ok: boolean; live: boolean; reason: string }> {
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow" });
    const html = await res.text();
    if (!res.ok) {
      return { ok: false, live: false, reason: `HTTP ${res.status}` };
    }
    const { live, reason } = merchStorefrontLiveFromHtml(html);
    return { ok: true, live, reason };
  } catch (e) {
    return {
      ok: false,
      live: false,
      reason: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export default async function CheckoutSetupPage() {
  const envRows = getAllEnvVars();
  const env = new Map(envRows.map((r) => [r.key, (r.value || "").trim()]));

  const story = REVENUE_APPS.find((a) => a.id === "storybook")!;
  const storyLinks = REVENUE_SETUP_LINKS.storybook;
  const onepage = REVENUE_APPS.find((a) => a.id === "1pageresearch")!;
  const onepageLinks = REVENUE_SETUP_LINKS["1pageresearch"];

  const missingRequired = STORYBOOK_CHECKOUT_REQUIRED_KEYS.filter((k) => !isSet(env, k));
  const preorderUrl = env.get("NEXT_PUBLIC_STORYBOOK_PREORDER_URL") || "";
  const liveProbe = await probeStorybookCheckout(`${story.publicUrl}/api/checkout/ready`);

  const missingOnepage = onepage.keys.filter((k) => !isSet(env, k));
  const onepageProbe = onepage.probeUrl ? await probeGenericCheckout(onepage.probeUrl) : null;
  const waitlist = await fetchStorybookPrintLeads();
  const liveWaitlist = liveProbe.waitlistCount ?? 0;
  const waitlistFamilies = Math.max(waitlist.length, liveWaitlist);
  const needsPaidPath = !liveProbe.ready && !liveProbe.preorderConfigured;
  const merchApp = REVENUE_APPS.find((a) => a.id === "merch")!;
  const merchStoreUrl = env.get("NEXT_PUBLIC_MERCH_STORE_URL") || "";
  const merchProbe = await probeMerchPage(merchApp.publicUrl);

  return (
    <section className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Checkout setup</h1>
        <p className="text-sm text-muted">
          Fastest path to the first paid sale is{" "}
          <a className="underline" href={story.publicUrl} target="_blank" rel="noreferrer">
            StoryMagic
          </a>
          . This page tells you exactly what to paste in <Link className="underline" href="/env">Env</Link>.
        </p>
      </div>

      {needsPaidPath && waitlistFamilies > 0 ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-5 space-y-2">
          <p className="text-sm font-semibold text-amber-100">
            {waitlistFamilies} famil{waitlistFamilies === 1 ? "y" : "ies"} on the StoryMagic waitlist — no paid path yet
          </p>
          <p className="text-xs text-muted">
            Fastest unlock: paste a Stripe Payment Link below (~2 min). After Save, use{" "}
            <Link href="/leads" className="underline text-accent">
              Leads → Copy preorder blast
            </Link>{" "}
            to email them.
          </p>
          <Link href="/leads" className="text-xs font-semibold text-accent hover:underline">
            View waitlist in Leads →
          </Link>
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">Refresh probes</div>
            <p className="text-xs text-muted mt-1">
              After you paste keys and hit Save on Env, you can run the droplet probe immediately (no waiting for cron).
            </p>
          </div>
          <Link className="text-xs font-semibold text-accent hover:underline" href="/cron">
            Cron →
          </Link>
        </div>
        <RunRevenueProbeButton />
        <p className="text-[11px] text-muted">
          Reusing keys: you can reuse the same <strong>Stripe account</strong> and the same{" "}
          <code className="text-[10px]">sk_test_…</code> secret key across apps, but each app needs its{" "}
          <strong>own webhook endpoint</strong> and signing secret (<code className="text-[10px]">whsec_…</code>).
        </p>
      </div>

      {!liveProbe.ready ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-4">
          <div className="text-sm font-semibold text-emerald-100">Fast path: preorder without webhook keys</div>
          <p className="text-xs text-muted">
            Stripe →{" "}
            <a
              className="underline text-accent"
              href="https://dashboard.stripe.com/test/payment-links/create"
              target="_blank"
              rel="noreferrer"
            >
              Payment Links (test)
            </a>{" "}
            → product ~${liveProbe.priceUsd ?? "24.99"} (e.g. &quot;StoryMagic printed hardcover&quot;) → paste the link
            here. StoryMagic shows <strong>Preorder now</strong> on hero, form, and preview (hot-reloads on save).
          </p>
          <CheckoutSetupEnvField
            envKey="NEXT_PUBLIC_STORYBOOK_PREORDER_URL"
            initialValue={preorderUrl}
            label="Stripe Payment Link (public URL)"
            placeholder="https://buy.stripe.com/test_…"
            hint="Not a secret. Full in-app checkout still needs the two Stripe keys in the section below."
            waitlistFamilies={waitlistFamilies}
          />
          {preorderUrl ? (
            <p className="text-[11px] text-emerald-300">
              Live test: create a book on{" "}
              <a className="underline" href={story.publicUrl} target="_blank" rel="noreferrer">
                StoryMagic
              </a>{" "}
              → confirm <strong>Preorder now</strong> opens your link.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">StoryMagic (full checkout)</div>
            <div className="text-xs text-muted">
              Webhook URL:{" "}
              <a className="underline" href={storyLinks.webhookUrl} target="_blank" rel="noreferrer">
                {storyLinks.webhookUrl}
              </a>
            </div>
          </div>
          <a
            className="text-xs font-semibold text-accent hover:underline"
            href={storyLinks.stripeDashboard}
            target="_blank"
            rel="noreferrer"
          >
            Stripe dashboard →
          </a>
        </div>

        <div className="text-xs text-muted">
          Paste Stripe <strong>test</strong> keys first. On save, admin hot-reloads StoryMagic on the droplet.
        </div>

        <div className="rounded-lg border border-border bg-background/40 px-3 py-3 text-xs space-y-2">
          <div className="font-semibold text-foreground">Stripe webhook (paid orders)</div>
          <ol className="list-decimal list-inside text-muted space-y-1">
            <li>
              Stripe → Developers → Webhooks → <strong>Add endpoint</strong>
            </li>
            <li>
              Endpoint URL:{" "}
              <code className="text-[11px] break-all">{storyLinks.webhookUrl}</code>
            </li>
            <li>
              Select event:{" "}
              <code className="text-[11px]">{STORYBOOK_STRIPE_WEBHOOK_EVENTS.join(", ")}</code>{" "}
              only (StoryMagic ignores other events)
            </li>
            <li>
              Copy the signing secret (<code className="text-[11px]">whsec_…</code>) into Env as{" "}
              <code className="text-[11px]">STORYBOOK_STRIPE_WEBHOOK_SECRET</code>
            </li>
          </ol>
          <p className="text-muted">
            Test: complete a $0.50 test checkout in Stripe test mode, then confirm admin{" "}
            <Link className="underline" href="/orders">
              Orders
            </Link>{" "}
            shows <strong>paid</strong>.
          </p>
        </div>

        <div className="space-y-2">
          {STORYBOOK_CHECKOUT_REQUIRED_KEYS.map((k) => {
            const ok = isSet(env, k);
            return (
              <div key={k} className="flex items-center justify-between gap-4">
                <code className="text-xs">{k}</code>
                <span
                  className={`text-xs font-semibold ${ok ? "text-emerald-300" : "text-amber-200"}`}
                >
                  {ok ? "set" : "missing"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          <div className="font-semibold text-muted">Live probe (storybook container)</div>
          {liveProbe.error ? (
            <div className="text-amber-200 mt-1">
              Could not reach checkout API: {liveProbe.error}
            </div>
          ) : liveProbe.ready ? (
            <div className="text-emerald-300 mt-1 font-semibold">
              ready: true — checkout can run
              {liveProbe.priceUsd ? ` (${liveProbe.priceUsd} USD)` : ""}
            </div>
          ) : liveProbe.preorderConfigured ? (
            <div className="text-emerald-300 mt-1 font-semibold">
              preorder: live — Payment Link active on StoryMagic
              {liveProbe.priceUsd ? ` (${liveProbe.priceUsd} USD)` : ""}
            </div>
          ) : (
            <div className="text-amber-200 mt-1">
              ready: false · preorder: off
              {liveProbe.missingKeys?.length
                ? ` — missing in runtime: ${liveProbe.missingKeys.join(", ")}`
                : missingRequired.length
                  ? " — keys not in admin Env yet"
                  : " — paste Payment Link above or add Stripe keys"}
            </div>
          )}
        </div>

        {missingRequired.length > 0 ? (
          <div className="pt-2 text-xs">
            <div className="text-amber-200 font-semibold">Next move</div>
            <div className="text-muted">
              Open <Link className="underline" href="/env">Env</Link> and add:{" "}
              <span className="font-mono">{missingRequired.join(", ")}</span>
            </div>
          </div>
        ) : !liveProbe.ready ? (
          <div className="pt-2 text-xs text-amber-200">
            Env keys look set in the DB; save Env again to hot-reload storybook, then refresh this page.
          </div>
        ) : (
          <div className="pt-2 text-xs text-emerald-300 font-semibold">
            Env + live probe agree — first sale path is open.
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">1PageResearch (also wired)</div>
            <div className="text-xs text-muted">
              Webhook URL:{" "}
              <a className="underline" href={onepageLinks.webhookUrl} target="_blank" rel="noreferrer">
                {onepageLinks.webhookUrl}
              </a>
            </div>
          </div>
          <a
            className="text-xs font-semibold text-accent hover:underline"
            href={onepageLinks.stripeDashboard}
            target="_blank"
            rel="noreferrer"
          >
            Stripe dashboard →
          </a>
        </div>

        <div className="text-xs text-muted">
          Paste Stripe <strong>test</strong> keys first. On save, admin hot-reloads 1PageResearch on the droplet.
        </div>

        <div className="space-y-2">
          {onepage.keys.map((k) => {
            const ok = isSet(env, k);
            return (
              <div key={k} className="flex items-center justify-between gap-4">
                <code className="text-xs">{k}</code>
                <span className={`text-xs font-semibold ${ok ? "text-emerald-300" : "text-amber-200"}`}>
                  {ok ? "set" : "missing"}
                </span>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          <div className="font-semibold text-muted">Live probe (1pageresearch container)</div>
          {!onepageProbe ? (
            <div className="text-muted mt-1">No probe configured.</div>
          ) : onepageProbe.error ? (
            <div className="text-amber-200 mt-1">Could not reach checkout API: {onepageProbe.error}</div>
          ) : onepageProbe.ready ? (
            <div className="text-emerald-300 mt-1 font-semibold">ready: true — checkout can run</div>
          ) : (
            <div className="text-amber-200 mt-1">
              ready: false
              {onepageProbe.missingKeys?.length
                ? ` — missing in runtime: ${onepageProbe.missingKeys.join(", ")}`
                : missingOnepage.length
                  ? " — keys not in admin Env yet"
                  : " — keys in Env but 1PageResearch may need a save/recreate"}
            </div>
          )}
        </div>

        {missingOnepage.length > 0 ? (
          <div className="pt-2 text-xs">
            <div className="text-amber-200 font-semibold">Next move</div>
            <div className="text-muted">
              Open <Link className="underline" href="/env">Env</Link> and add:{" "}
              <span className="font-mono">{missingOnepage.join(", ")}</span>
            </div>
          </div>
        ) : onepageProbe && !onepageProbe.ready ? (
          <div className="pt-2 text-xs text-amber-200">
            Env keys look set in the DB; save Env again to hot-reload 1PageResearch, then refresh this page.
          </div>
        ) : onepageProbe?.ready ? (
          <div className="pt-2 text-xs text-emerald-300 font-semibold">
            Env + live probe agree — 1PageResearch checkout is open.
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-fuchsia-500/25 bg-fuchsia-500/5 p-5 space-y-4">
        <div className="text-sm font-semibold text-fuchsia-100">Merch storefront (Printful or partner URL)</div>
        <p className="text-xs text-muted">
          Catalog lives at{" "}
          <a className="underline" href={merchApp.publicUrl} target="_blank" rel="noreferrer">
            merch.6cubed.app
          </a>
          . Until a storefront URL is set, Buy buttons route to StoryMagic. Setup guide:{" "}
          <code className="text-[10px]">docs/MERCH-FIRST-SALE.md</code> in repo.
        </p>
        <ul className="text-xs text-muted list-disc list-inside space-y-0.5">
          <li>6³ wordmark tee · 216Labs stack tee · Production-grade vibes hoodie</li>
          <li>Cube snapback · sticker sheet · canvas tote · enamel mug · crew socks</li>
        </ul>
        <CheckoutSetupEnvField
          envKey="NEXT_PUBLIC_MERCH_STORE_URL"
          initialValue={merchStoreUrl}
          label="Storefront base URL (public)"
          placeholder="https://your-store.printful.me/"
          hint="Not a secret. Save recreates the merch container on the droplet."
          saveLabel="Save & reload merch"
        />
        <div className="rounded-lg border border-border px-3 py-2 text-xs">
          <div className="font-semibold text-muted">Live probe (merch page)</div>
          {!merchProbe.ok ? (
            <div className="text-amber-200 mt-1">Could not reach merch: {merchProbe.reason}</div>
          ) : merchProbe.live ? (
            <div className="text-emerald-300 mt-1 font-semibold">storefront live — {merchProbe.reason}</div>
          ) : (
            <div className="text-amber-200 mt-1">{merchProbe.reason}</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold">Other revenue apps</div>
        <div className="text-xs text-muted">
          These are also wired for paid checkout, but StoryMagic is the fastest first sale.
        </div>
        <div className="space-y-3">
          {REVENUE_APPS.filter((a) => a.id !== "storybook" && a.id !== "merch").map((app) => {
            const links = REVENUE_SETUP_LINKS[app.id as keyof typeof REVENUE_SETUP_LINKS];
            const missing = app.keys.filter((k) => !isSet(env, k));
            return (
              <div key={app.id} className="rounded-lg border border-border px-4 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">{app.label}</div>
                    <div className="text-xs text-muted">
                      {links?.webhookUrl ? (
                        <>
                          Webhook URL:{" "}
                          <a className="underline" href={links.webhookUrl} target="_blank" rel="noreferrer">
                            {links.webhookUrl}
                          </a>
                        </>
                      ) : (
                        <span>Keys only</span>
                      )}
                    </div>
                  </div>
                  {links?.stripeDashboard ? (
                    <a
                      className="text-xs font-semibold text-accent hover:underline"
                      href={links.stripeDashboard}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Stripe →
                    </a>
                  ) : null}
                </div>
                <div className="mt-2 text-xs text-muted">
                  Missing:{" "}
                  <span className="font-mono">
                    {missing.length ? missing.join(", ") : "(none)"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

