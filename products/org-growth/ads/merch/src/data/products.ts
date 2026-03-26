export type MerchCategory = "apparel" | "accessories" | "stationery"

export type MerchProduct = {
  id: string
  name: string
  tagline: string
  priceFrom: string
  category: MerchCategory
  /** Absolute URL for this SKU. If omitted, the default store URL from env is used when set. */
  purchaseUrl?: string | null
  badge?: "new" | "limited"
}

export const categoryLabel: Record<MerchCategory, string> = {
  apparel: "Apparel",
  accessories: "Accessories",
  stationery: "Stationery",
}

/** Extend or replace with your real catalog and checkout links. */
export const products: MerchProduct[] = [
  {
    id: "tee-cube-logo",
    name: "6³ wordmark tee",
    tagline: "Soft tri-blend, front hit with the cube mark. Unisex fit.",
    priceFrom: "$28",
    category: "apparel",
    badge: "new",
  },
  {
    id: "tee-216-stack",
    name: "216Labs stack tee",
    tagline: 'Monospace "216" stack on the chest — for people who ship.',
    priceFrom: "$28",
    category: "apparel",
  },
  {
    id: "hoodie-vibes",
    name: "Production-grade vibes hoodie",
    tagline: "Heavyweight fleece, minimal back print. Built for late deploys.",
    priceFrom: "$64",
    category: "apparel",
    badge: "limited",
  },
  {
    id: "cap-snapback",
    name: "Cube snapback",
    tagline: "Structured crown, tonal embroidery. One profile line.",
    priceFrom: "$32",
    category: "accessories",
  },
  {
    id: "sticker-sheet",
    name: "Sticker sheet (mixed marks)",
    tagline: "Die-cut 6cubed + 216Labs marks — laptop grade vinyl.",
    priceFrom: "$12",
    category: "stationery",
  },
  {
    id: "tote-canvas",
    name: "Canvas tote",
    tagline: "Market run, conference floor, or carrying a laptop to the café.",
    priceFrom: "$22",
    category: "accessories",
  },
  {
    id: "mug-enamel",
    name: "Enamel camp mug",
    tagline: "Speckled enamel with a small cube mark. Campfire optional.",
    priceFrom: "$18",
    category: "stationery",
  },
  {
    id: "socks-crew",
    name: "Crew socks (pair)",
    tagline: "Subtle pattern, comfortable blend — merch you actually wear.",
    priceFrom: "$16",
    category: "apparel",
  },
]
