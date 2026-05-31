export type CheckoutReady = {
  ready?: boolean;
  preorderConfigured?: boolean;
  preorderUrl?: string;
  priceUsd?: string;
};

export function merchStorymagicHref(preorderUrl: string, medium: string): string {
  const u = new URL(preorderUrl);
  if (!u.searchParams.has("utm_source")) u.searchParams.set("utm_source", "merch");
  if (!u.searchParams.has("utm_medium")) u.searchParams.set("utm_medium", medium);
  if (!u.searchParams.has("utm_campaign")) u.searchParams.set("utm_campaign", "catalog");
  return u.toString();
}

export function merchStorymagicPreviewHref(medium: string): string {
  const u = new URL("https://storybook.6cubed.app/");
  u.searchParams.set("utm_source", "merch");
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", "catalog");
  return u.toString();
}
