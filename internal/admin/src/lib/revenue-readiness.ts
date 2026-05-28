import type { DbEnvVar } from "@/lib/db";
import { getCronRunnerState } from "@/lib/db";
import { fetchStorybookPrintLeads } from "@/lib/storybook";

/** Matches cron-runner `revenueEnvCheck` state key. */
export const REVENUE_CRON_STATE_KEY = "revenue_env_last";

export type RevenueAppConfig = {
  id: string;
  label: string;
  keys: string[];
  probeUrl: string | null;
  publicUrl: string;
};

/** Stripe / storefront shortcuts shown on admin Env when keys are incomplete. */
export const REVENUE_SETUP_LINKS: Record<
  string,
  { stripeDashboard?: string; webhookUrl?: string; deployHint?: string }
> = {
  storybook: {
    stripeDashboard: "https://dashboard.stripe.com/test/apikeys",
    webhookUrl: "https://storybook.6cubed.app/api/webhook",
    deployHint:
      "Save STORYBOOK_* below → admin regenerates .env.admin and recreates storybook (no laptop deploy).",
  },
  "1pageresearch": {
    stripeDashboard: "https://dashboard.stripe.com/test/apikeys",
    webhookUrl: "https://1pageresearch.6cubed.app/api/webhook/stripe",
    deployHint:
      "Save ONEPAGE_* below → admin recreates 1pageresearch. Fallback: DEPLOY_RUNTIME_APPS=1pageresearch ./deploy.sh",
  },
  merch: {
    stripeDashboard: undefined,
    webhookUrl: undefined,
    deployHint: "Set NEXT_PUBLIC_MERCH_STORE_URL (Printful storefront URL)",
  },
};

/** StoryMagic Checkout Sessions are server-side; publishable key is optional until client Stripe.js. */
export const STORYBOOK_CHECKOUT_REQUIRED_KEYS = [
  "STORYBOOK_STRIPE_SECRET_KEY",
  "STORYBOOK_STRIPE_WEBHOOK_SECRET",
] as const;

/** Stripe Dashboard → Webhooks → “Select events” for StoryMagic. */
export const STORYBOOK_STRIPE_WEBHOOK_EVENTS = ["checkout.session.completed"] as const;

export const REVENUE_APPS: RevenueAppConfig[] = [
  {
    id: "storybook",
    label: "StoryMagic",
    keys: [
      "STORYBOOK_STRIPE_SECRET_KEY",
      "STORYBOOK_STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY",
      "NEXT_PUBLIC_STORYBOOK_PREORDER_URL",
    ],
    probeUrl: "https://storybook.6cubed.app/api/checkout/ready",
    publicUrl: "https://storybook.6cubed.app",
  },
  {
    id: "1pageresearch",
    label: "1PageResearch",
    keys: ["ONEPAGE_STRIPE_SECRET_KEY", "ONEPAGE_STRIPE_WEBHOOK_SECRET"],
    probeUrl: "https://1pageresearch.6cubed.app/api/checkout/ready",
    publicUrl: "https://1pageresearch.6cubed.app",
  },
  {
    id: "merch",
    label: "Merch",
    keys: ["NEXT_PUBLIC_MERCH_STORE_URL"],
    probeUrl: null,
    publicUrl: "https://merch.6cubed.app",
  },
];

export type RevenueAppStatus = {
  id: string;
  label: string;
  keys: Array<{ key: string; set: boolean }>;
  keysReady: boolean;
  probeUrl: string | null;
  publicUrl: string;
  probeOk: boolean | null;
  probeReady: boolean | null;
  probeMessage: string | null;
  probeError: string | null;
};

export type RevenueCronProbeRow = {
  id: string;
  label: string;
  ok: boolean;
  status?: number;
  ready?: boolean | null;
  error?: string | null;
};

export type RevenueCronSnapshot = {
  at: string;
  issues: number;
  results: RevenueCronProbeRow[];
};

export type RevenueReadinessSnapshot = {
  apps: RevenueAppStatus[];
  allCheckoutReady: boolean;
  lastCronProbe: RevenueCronSnapshot | null;
  /** Print-interest emails while StoryMagic checkout is off (internal storybook API). */
  storybookPrintLeadCount: number | null;
};

export function parseRevenueCronSnapshot(
  raw: string | null
): RevenueCronSnapshot | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as RevenueCronSnapshot;
    if (!d?.at || !Array.isArray(d.results)) return null;
    return d;
  } catch {
    return null;
  }
}

function envMap(vars: DbEnvVar[]): Map<string, string> {
  return new Map(vars.map((v) => [v.key, (v.value ?? "").trim()]));
}

async function probeCheckoutReady(url: string): Promise<{
  ok: boolean;
  ready: boolean | null;
  message: string | null;
  error: string | null;
}> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    const text = await res.text();
    if (!text.includes('"ready"')) {
      return {
        ok: false,
        ready: null,
        message: null,
        error: res.ok
          ? "Non-JSON response (container cold or edge down)"
          : `HTTP ${res.status}`,
      };
    }
    const data = JSON.parse(text) as { ready?: boolean; message?: string };
    return {
      ok: true,
      ready: Boolean(data.ready),
      message: typeof data.message === "string" ? data.message : null,
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Probe failed";
    return { ok: false, ready: null, message: null, error: msg };
  }
}

async function probeMerchStorefront(url: string): Promise<{
  ok: boolean;
  ready: boolean | null;
  message: string | null;
  error: string | null;
}> {
  try {
    const res = await fetch(url, {
      cache: "no-store",
      redirect: "follow",
      signal: AbortSignal.timeout(12_000),
    });
    const html = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        ready: null,
        message: null,
        error: `HTTP ${res.status}`,
      };
    }
    const fallback =
      html.includes("Checkout URL not configured") ||
      html.includes("Shop StoryMagic");
    return {
      ok: true,
      ready: !fallback,
      message: fallback
        ? "Buy uses StoryMagic fallback until NEXT_PUBLIC_MERCH_STORE_URL is set"
        : "Storefront URL appears active",
      error: null,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Probe failed";
    return { ok: false, ready: null, message: null, error: msg };
  }
}

export async function getRevenueReadiness(
  vars: DbEnvVar[]
): Promise<RevenueReadinessSnapshot> {
  const map = envMap(vars);

  const apps: RevenueAppStatus[] = await Promise.all(
    REVENUE_APPS.map(async (cfg) => {
      const keys = cfg.keys.map((key) => ({
        key,
        set: Boolean(map.get(key)),
      }));
      const keysReady =
        cfg.id === "storybook"
          ? STORYBOOK_CHECKOUT_REQUIRED_KEYS.every((key) => Boolean(map.get(key)))
          : keys.every((k) => k.set);

      let probeOk: boolean | null = null;
      let probeReady: boolean | null = null;
      let probeMessage: string | null = null;
      let probeError: string | null = null;

      if (cfg.id === "merch") {
        const p = await probeMerchStorefront(cfg.publicUrl);
        probeOk = p.ok;
        probeReady = p.ready;
        probeMessage = p.message;
        probeError = p.error;
      } else if (cfg.probeUrl) {
        const p = await probeCheckoutReady(cfg.probeUrl);
        probeOk = p.ok;
        probeReady = p.ready;
        probeMessage = p.message;
        probeError = p.error;
      }

      return {
        id: cfg.id,
        label: cfg.label,
        keys,
        keysReady,
        probeUrl: cfg.probeUrl,
        publicUrl: cfg.publicUrl,
        probeOk,
        probeReady,
        probeMessage,
        probeError,
      };
    })
  );

  const allCheckoutReady = apps.every(
    (a) => a.probeOk === true && a.probeReady === true
  );

  const lastCronProbe = parseRevenueCronSnapshot(
    getCronRunnerState(REVENUE_CRON_STATE_KEY)
  );

  let storybookPrintLeadCount: number | null = null;
  const storybookApp = apps.find((a) => a.id === "storybook");
  if (storybookApp && storybookApp.probeReady !== true) {
    try {
      const leads = await fetchStorybookPrintLeads();
      storybookPrintLeadCount = leads.length;
    } catch {
      storybookPrintLeadCount = null;
    }
  }

  return { apps, allCheckoutReady, lastCronProbe, storybookPrintLeadCount };
}
