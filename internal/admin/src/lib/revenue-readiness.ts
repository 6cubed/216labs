import type { DbEnvVar } from "@/lib/db";

export type RevenueAppConfig = {
  id: string;
  label: string;
  keys: string[];
  probeUrl: string | null;
  publicUrl: string;
};

export const REVENUE_APPS: RevenueAppConfig[] = [
  {
    id: "storybook",
    label: "StoryMagic",
    keys: [
      "STORYBOOK_STRIPE_SECRET_KEY",
      "STORYBOOK_STRIPE_WEBHOOK_SECRET",
      "NEXT_PUBLIC_STORYBOOK_STRIPE_PUBLISHABLE_KEY",
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

export type RevenueReadinessSnapshot = {
  apps: RevenueAppStatus[];
  allCheckoutReady: boolean;
};

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
      const keysReady = keys.every((k) => k.set);

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

  return { apps, allCheckoutReady };
}
