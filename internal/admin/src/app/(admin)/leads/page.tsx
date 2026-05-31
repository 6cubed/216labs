import Link from "next/link";
import { StorybookPrintLeadsSection } from "@/components/StorybookPrintLeadsSection";
import { getDb } from "@/lib/db";
import {
  fetchOnePageCheckoutWaitlist,
  isOnePageCheckoutWaitlistLead,
  isStorymagicPartnerLead,
} from "@/lib/revenue-leads";
import { fetchStorybookPrintLeads } from "@/lib/storybook";

export const dynamic = "force-dynamic";

type LeadRow = {
  id: string;
  created_at: string;
  kind: string;
  email: string;
  message: string;
  source_app_id: string;
  referrer: string | null;
};

function safeTrim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

async function storybookPaidPath(): Promise<{
  ready: boolean;
  preorder: boolean;
  preorderUrl: string;
  priceUsd: string;
}> {
  try {
    const res = await fetch("https://storybook.6cubed.app/api/checkout/ready", {
      cache: "no-store",
    });
    const data = (await res.json()) as {
      ready?: boolean;
      preorderConfigured?: boolean;
      preorderUrl?: string;
      priceUsd?: string;
    };
    return {
      ready: Boolean(data.ready),
      preorder: Boolean(data.preorderConfigured),
      preorderUrl: data.preorderUrl?.trim() ?? "",
      priceUsd: data.priceUsd ?? "24.99",
    };
  } catch {
    return { ready: false, preorder: false, preorderUrl: "", priceUsd: "24.99" };
  }
}

async function onepageCheckoutReady(): Promise<boolean> {
  try {
    const res = await fetch("https://1pageresearch.6cubed.app/api/checkout/ready", {
      cache: "no-store",
    });
    const data = (await res.json()) as { ready?: boolean };
    return Boolean(data.ready);
  } catch {
    return false;
  }
}

export default async function LeadsPage() {
  const [storybookPrintLeads, paidPath, onepageReady, onePageWaitlistLeads] = await Promise.all([
    fetchStorybookPrintLeads(),
    storybookPaidPath(),
    onepageCheckoutReady(),
    Promise.resolve(fetchOnePageCheckoutWaitlist()),
  ]);
  const needsPaidPath =
    storybookPrintLeads.length > 0 && !paidPath.ready && !paidPath.preorder;
  const needsOnepageCheckout =
    onePageWaitlistLeads.length > 0 && !onepageReady;
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, created_at, kind, email, message, source_app_id, referrer
       FROM lead_event
       ORDER BY created_at DESC
       LIMIT 200`
    )
    .all() as LeadRow[];

  const partnerLeads = rows.filter(isStorymagicPartnerLead);
  const onePageLeads = rows.filter(isOnePageCheckoutWaitlistLead);
  const ingestLeads = rows.filter(
    (r) => !isStorymagicPartnerLead(r) && !isOnePageCheckoutWaitlistLead(r)
  );

  return (
    <section className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted">
            Hire form, StoryMagic B2B, 1Page €1 checkout waitlist, KidGift, and other funnels.
          </p>
        </div>
        <div className="text-xs text-muted">
          Showing <span className="font-semibold text-foreground">{rows.length}</span> most recent
        </div>
      </div>

      {needsPaidPath ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-amber-100">
            {storybookPrintLeads.length} on StoryMagic waitlist — they cannot pay yet
          </p>
          <p className="text-xs text-muted mt-1">
            Enable a Payment Link or full Stripe checkout on{" "}
            <Link href="/checkout-setup" className="underline text-accent">
              Checkout setup
            </Link>
            . Telegram: <code className="text-[11px]">/waitlist</code>
          </p>
        </div>
      ) : paidPath.preorder && storybookPrintLeads.length > 0 ? (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-emerald-100">
            Preorder live — {storybookPrintLeads.length} waitlist emails ready to blast
          </p>
          <p className="text-xs text-muted mt-1">
            Use <strong>Copy preorder blast</strong> below (includes BCC list + Payment Link with UTMs).
          </p>
        </div>
      ) : null}

      {needsOnepageCheckout ? (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-sm">
          <p className="font-semibold text-cyan-100">
            {onePageWaitlistLeads.length} waiting for 1PageResearch €1 checkout
          </p>
          <p className="text-xs text-muted mt-1">
            Add <code className="text-[11px]">ONEPAGE_STRIPE_*</code> on{" "}
            <Link href="/checkout-setup" className="underline text-accent">
              Checkout setup
            </Link>
            , then email the list from the section below.
          </p>
        </div>
      ) : null}

      <StorybookPrintLeadsSection
        leads={storybookPrintLeads}
        preorderUrl={paidPath.preorderUrl}
        priceUsd={paidPath.priceUsd}
      />

      {partnerLeads.length > 0 ? (
        <div className="rounded-xl border border-violet-500/40 bg-violet-500/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-violet-500/30">
            <p className="font-semibold text-violet-100">
              StoryMagic B2B — {partnerLeads.length} partnership{" "}
              {partnerLeads.length === 1 ? "inquiry" : "inquiries"}
            </p>
            <p className="text-xs text-muted mt-1">
              From{" "}
              <a className="underline" href="https://6cubed.app/">
                6cubed.app
              </a>{" "}
              daycare / school / bulk print form.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="bg-muted/20">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Message</th>
                </tr>
              </thead>
              <tbody>
                {partnerLeads.map((r) => (
                  <tr key={r.id} className="border-t border-violet-500/20">
                    <td className="px-4 py-2 whitespace-nowrap text-muted">{safeTrim(r.created_at)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      <a className="underline" href={`mailto:${encodeURIComponent(safeTrim(r.email))}`}>
                        {safeTrim(r.email)}
                      </a>
                    </td>
                    <td className="px-4 py-2">{safeTrim(r.message) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {onePageLeads.length > 0 ? (
        <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 overflow-hidden">
          <div className="px-4 py-3 border-b border-cyan-500/30">
            <p className="font-semibold text-cyan-100">
              1PageResearch €1 checkout — {onePageLeads.length}{" "}
              {onePageLeads.length === 1 ? "signup" : "signups"}
            </p>
            <p className="text-xs text-muted mt-1">
              From{" "}
              <a className="underline" href="https://1pageresearch.6cubed.app/generate">
                1pageresearch.6cubed.app/generate
              </a>{" "}
              “Notify me at launch”.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[700px] w-full text-sm">
              <thead className="bg-muted/20">
                <tr className="text-left">
                  <th className="px-4 py-2 font-semibold">When</th>
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Topic interest</th>
                </tr>
              </thead>
              <tbody>
                {onePageLeads.map((r) => {
                  const msg = safeTrim(r.message);
                  const topic = msg.includes("topic:")
                    ? msg.split("topic:").slice(1).join("topic:").trim()
                    : "—";
                  return (
                    <tr key={r.id} className="border-t border-cyan-500/20">
                      <td className="px-4 py-2 whitespace-nowrap text-muted">{safeTrim(r.created_at)}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        <a className="underline" href={`mailto:${encodeURIComponent(safeTrim(r.email))}`}>
                          {safeTrim(r.email)}
                        </a>
                      </td>
                      <td className="px-4 py-2">{topic || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted">
          No ingest leads yet. StoryMagic waitlist may still appear above. Forms on{" "}
          <a className="underline" href="https://6cubed.app/">
            6cubed.app
          </a>{" "}
          (hire + B2B partnership).
        </div>
      ) : ingestLeads.length === 0 ? null : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold">When</th>
                  <th className="px-4 py-3 font-semibold">Kind</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="px-4 py-3 font-semibold">Message</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                </tr>
              </thead>
              <tbody>
                {ingestLeads.map((r) => {
                  const email = safeTrim(r.email);
                  const message = safeTrim(r.message);
                  const when = safeTrim(r.created_at);
                  const kind = safeTrim(r.kind) || "lead";
                  const source = safeTrim(r.source_app_id);
                  return (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{when}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-full border border-border px-2 py-0.5 text-xs">
                          {kind}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {email ? (
                          <a className="underline" href={`mailto:${encodeURIComponent(email)}`}>
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {message ? (
                          <span className="text-foreground">{message}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                        {r.referrer ? (
                          <div className="mt-1 text-xs text-muted">
                            <span className="font-mono">ref:</span> {r.referrer}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-muted">{source || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

