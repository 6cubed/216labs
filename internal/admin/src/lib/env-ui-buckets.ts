/**
 * Groups env var keys for the admin Env page (browse/search without a giant flat list).
 */

export type EnvUiCategoryId =
  | "platform"
  | "deploy"
  | "telegram"
  | "analytics"
  | "openai_overrides"
  | "app_other";

export const ENV_UI_CATEGORY_ORDER: EnvUiCategoryId[] = [
  "platform",
  "deploy",
  "telegram",
  "analytics",
  "openai_overrides",
  "app_other",
];

export const ENV_UI_CATEGORY_LABEL: Record<EnvUiCategoryId, string> = {
  platform: "Platform (shared)",
  deploy: "Deploy & registry",
  telegram: "Telegram & workforce",
  analytics: "Analytics",
  openai_overrides: "Optional per-app OpenAI overrides",
  app_other: "Per-app & other",
};

export const ENV_UI_CATEGORY_HINT: Record<EnvUiCategoryId, string> = {
  platform:
    "Set OPENAI_API_KEY once; use API metadata (e.g. user id) for usage tracking instead of separate keys per product.",
  deploy: "GHCR, activator, GitHub feed, cron runner secret.",
  telegram: "Bot token, chat IDs, group hourly job, Workforce test chat.",
  analytics: "GA4 web stream and property id.",
  openai_overrides:
    "Only if an app needs its own key. Compose prefers OPENAI_API_KEY when set.",
  app_other: "Keys namespaced by app prefix (e.g. ONEROOM_, NEXT_PUBLIC_…).",
};

/** Single-segment “slug” for per-app keys (e.g. ONEROOM from ONEROOM_FOO). */
export function appSlugFromKey(key: string): string | null {
  if (key.startsWith("NEXT_PUBLIC_")) {
    const rest = key.slice("NEXT_PUBLIC_".length);
    const first = rest.split("_")[0];
    return first && /^[A-Z0-9]+$/i.test(first) ? first.toUpperCase() : null;
  }
  const first = key.split("_")[0];
  if (!first || !/^[A-Z0-9]+$/i.test(first)) return null;
  // Skip keys that look like generic words we bucket elsewhere
  const upper = first.toUpperCase();
  if (
    ["GA", "GHCR", "TELEGRAM", "OPENAI", "CRON", "ADMIN", "ACTIVATOR", "WORKFORCE"].includes(
      upper
    )
  ) {
    return null;
  }
  return upper;
}

export function classifyEnvKey(key: string): {
  category: EnvUiCategoryId;
  /** For app_other: subgroup label */
  subKey: string | null;
} {
  if (key === "OPENAI_API_KEY") {
    return { category: "platform", subKey: null };
  }

  if (
    key === "ACTIVATOR_REGISTRY_PREFIX" ||
    key.startsWith("GHCR_") ||
    key === "ADMIN_GITHUB_TOKEN" ||
    key.startsWith("CRON_RUNNER")
  ) {
    return { category: "deploy", subKey: null };
  }

  if (
    key === "TELEGRAM_GROUP_HOURLY_OPENAI_API_KEY" ||
    key === "TELEGRAM_GROUP_HOURLY_OPENAI_MODEL"
  ) {
    return { category: "openai_overrides", subKey: null };
  }

  if (key.startsWith("TELEGRAM") || key.startsWith("WORKFORCE_")) {
    return { category: "telegram", subKey: null };
  }

  if (key.startsWith("GA_") || key === "GA4_PROPERTY_ID") {
    return { category: "analytics", subKey: null };
  }

  if (/_OPENAI_/i.test(key)) {
    return { category: "openai_overrides", subKey: null };
  }

  const slug = appSlugFromKey(key);
  if (slug) {
    return { category: "app_other", subKey: slug };
  }

  return { category: "app_other", subKey: "_other" };
}
