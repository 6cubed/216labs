/**
 * Curated AI-assisted prints (museum-style catalogue). Swap images under /public/art.
 */

export interface ArtPrint {
  id: string;
  title: string;
  subtitle: string;
  /** Path under public/, e.g. /art/nebula.svg */
  imageSrc: string;
  /** Price in USD cents; falls back to env default when omitted */
  priceCents?: number;
  medium: string;
  dimensions: string;
}

export const PRINTS: ArtPrint[] = [
  {
    id: "nebula-stitch",
    title: "Nebula Stitch",
    subtitle: "Diffusion study · indigo / coral",
    imageSrc: "/art/nebula.svg",
    priceCents: 7900,
    medium: "Archival giclée on cotton rag",
    dimensions: '12 × 16" (30 × 40 cm)',
  },
  {
    id: "glyph-garden",
    title: "Glyph Garden",
    subtitle: "Latent walk · midnight grid",
    imageSrc: "/art/glyph.svg",
    priceCents: 6900,
    medium: "Archival giclée on cotton rag",
    dimensions: '11 × 14" (28 × 36 cm)',
  },
  {
    id: "soft-static",
    title: "Soft Static",
    subtitle: "Noise field · paper warmth",
    imageSrc: "/art/static.svg",
    priceCents: 5900,
    medium: "Archival giclée on cotton rag",
    dimensions: '10 × 10" (25 × 25 cm)',
  },
  {
    id: "horizon-loop",
    title: "Horizon Loop",
    subtitle: "Seamless gradient study",
    imageSrc: "/art/horizon.svg",
    priceCents: 8900,
    medium: "Archival giclée on cotton rag",
    dimensions: '16 × 12" (40 × 30 cm)',
  },
];

export function getPrint(id: string): ArtPrint | undefined {
  return PRINTS.find((p) => p.id === id);
}

export function defaultPriceCents(): number {
  const raw = process.env.AIART_DEFAULT_PRINT_PRICE_CENTS ?? "6900";
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 6900;
}

export function priceForPrint(p: ArtPrint): number {
  return p.priceCents ?? defaultPriceCents();
}
