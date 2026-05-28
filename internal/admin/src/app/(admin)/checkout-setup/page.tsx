import Link from "next/link";
import { getAllEnvVars } from "@/lib/db";
import {
  REVENUE_APPS,
  REVENUE_SETUP_LINKS,
  STORYBOOK_CHECKOUT_REQUIRED_KEYS,
} from "@/lib/revenue-readiness";

export const dynamic = "force-dynamic";

function isSet(env: Map<string, string>, key: string): boolean {
  return Boolean(env.get(key)?.trim());
}

type CheckoutProbe = {
  ok: boolean;
  ready: boolean;
  priceUsd?: string;
  missingKeys?: string[];
  error?: string;
};

async function probeStorybookCheckout(url: string): Promise<CheckoutProbe> {
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
      priceUsd: data.priceUsd,
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

export default async function CheckoutSetupPage() {
  const envRows = getAllEnvVars();
  const env = new Map(envRows.map((r) => [r.key, (r.value || "").trim()]));

  const story = REVENUE_APPS.find((a) => a.id === "storybook")!;
  const storyLinks = REVENUE_SETUP_LINKS.storybook;
  const onepage = REVENUE_APPS.find((a) => a.id === "1pageresearch")!;
  const onepageLinks = REVENUE_SETUP_LINKS["1pageresearch"];

  const missingRequired = STORYBOOK_CHECKOUT_REQUIRED_KEYS.filter((k) => !isSet(env, k));
  const liveProbe = await probeStorybookCheckout(`${story.publicUrl}/api/checkout/ready`);

  const missingOnepage = onepage.keys.filter((k) => !isSet(env, k));
  const onepageProbe = onepage.probeUrl ? await probeGenericCheckout(onepage.probeUrl) : null;

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

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold">StoryMagic (required)</div>
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
          ) : (
            <div className="text-amber-200 mt-1">
              ready: false
              {liveProbe.missingKeys?.length
                ? ` — missing in runtime: ${liveProbe.missingKeys.join(", ")}`
                : missingRequired.length
                  ? " — keys not in admin Env yet"
                  : " — keys in Env but storybook may need a save/recreate"}
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

      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="text-sm font-semibold">Other revenue apps</div>
        <div className="text-xs text-muted">
          These are also wired for paid checkout, but StoryMagic is the fastest first sale.
        </div>
        <div className="space-y-3">
          {REVENUE_APPS.filter((a) => a.id !== "storybook").map((app) => {
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

