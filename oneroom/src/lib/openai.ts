import OpenAI, { toFile } from "openai";

function getClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is required. Please enter your key above.");
  return new OpenAI({ apiKey: key });
}

export interface DesignRecommendation {
  id: number;
  title: string;
  description: string;
  items: FurnitureItem[];
  imageUrl: string | null;
  designNotes: string;
}

export interface FurnitureItem {
  name: string;
  category: string;
  color: string;
  material: string;
  searchQuery: string;
  links: ShopLink[];
}

export interface ShopLink {
  store: string;
  url: string;
}

export function buildFashionLinks(query: string, country: string): ShopLink[] {
  const enc = encodeURIComponent(query);

  // Global fashion links always included
  const global: ShopLink[] = [
    { store: "ASOS", url: `https://www.asos.com/search/?q=${enc}` },
    { store: "H&M", url: `https://www2.hm.com/en_gb/search-results.html?q=${enc}` },
    { store: "Zara", url: `https://www.zara.com/us/en/search?searchTerm=${enc}` },
    { store: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${enc}+clothing` },
  ];

  const regional: Record<string, ShopLink[]> = {
    US: [
      { store: "Nordstrom", url: `https://www.nordstrom.com/sr?origin=keywordsearch&keyword=${enc}` },
      { store: "Macy's", url: `https://www.macys.com/shop/featured/${enc}` },
      { store: "Revolve", url: `https://www.revolve.com/r/Search.jsp?q=${enc}` },
      { store: "Amazon Fashion", url: `https://www.amazon.com/s?k=${enc}&i=fashion` },
    ],
    GB: [
      { store: "Marks & Spencer", url: `https://www.marksandspencer.com/l/search-results?q=${enc}` },
      { store: "Selfridges", url: `https://www.selfridges.com/GB/en/features/search/?q=${enc}` },
      { store: "ASOS UK", url: `https://www.asos.com/search/?q=${enc}` },
      { store: "River Island", url: `https://www.riverisland.com/search?q=${enc}` },
    ],
    AU: [
      { store: "THE ICONIC", url: `https://www.theiconic.com.au/search/?q=${enc}` },
      { store: "David Jones", url: `https://www.davidjones.com/search?q=${enc}` },
      { store: "Cotton On", url: `https://cottonon.com/AU/search/?q=${enc}` },
      { store: "ASOS AU", url: `https://www.asos.com/au/search/?q=${enc}` },
    ],
    CA: [
      { store: "Hudson's Bay", url: `https://www.thebay.com/search?q=${enc}` },
      { store: "SSENSE", url: `https://www.ssense.com/en-ca/search?q=${enc}` },
      { store: "Reitmans", url: `https://www.reitmans.com/search?q=${enc}` },
      { store: "Amazon CA", url: `https://www.amazon.ca/s?k=${enc}&i=fashion` },
    ],
    DE: [
      { store: "Zalando", url: `https://www.zalando.de/katalog/?q=${enc}` },
      { store: "About You", url: `https://www.aboutyou.de/search?query=${enc}` },
      { store: "C&A", url: `https://www.c-and-a.com/de/de/shop/search?q=${enc}` },
      { store: "Amazon.de", url: `https://www.amazon.de/s?k=${enc}&i=fashion` },
    ],
    FR: [
      { store: "Galeries Lafayette", url: `https://www.galerieslafayette.com/search?q=${enc}` },
      { store: "La Redoute", url: `https://www.laredoute.fr/recherche/?q=${enc}` },
      { store: "Sandro", url: `https://www.sandro-paris.com/en-fr/search?q=${enc}` },
      { store: "Amazon.fr", url: `https://www.amazon.fr/s?k=${enc}&i=fashion` },
    ],
    NL: [
      { store: "Zalando NL", url: `https://www.zalando.nl/katalog/?q=${enc}` },
      { store: "About You NL", url: `https://www.aboutyou.nl/search?query=${enc}` },
      { store: "Amazon.nl", url: `https://www.amazon.nl/s?k=${enc}&i=fashion` },
    ],
    SE: [
      { store: "Boozt", url: `https://www.boozt.com/se/sv/search?q=${enc}` },
      { store: "Nelly", url: `https://nelly.com/se/kl%C3%A4der-dam/?q=${enc}` },
      { store: "H&M SE", url: `https://www2.hm.com/sv_se/search-results.html?q=${enc}` },
    ],
    IT: [
      { store: "Zalando IT", url: `https://www.zalando.it/katalog/?q=${enc}` },
      { store: "La Rinascente", url: `https://www.rinascente.it/rinascente/search?SearchTerm=${enc}` },
      { store: "Amazon.it", url: `https://www.amazon.it/s?k=${enc}&i=fashion` },
    ],
    ES: [
      { store: "El Corte Inglés", url: `https://www.elcorteingles.es/moda/?s=${enc}` },
      { store: "Zalando ES", url: `https://www.zalando.es/katalog/?q=${enc}` },
      { store: "Amazon.es", url: `https://www.amazon.es/s?k=${enc}&i=fashion` },
    ],
    NO: [
      { store: "Boozt NO", url: `https://www.boozt.com/no/nb/search?q=${enc}` },
      { store: "H&M NO", url: `https://www2.hm.com/no_no/search-results.html?q=${enc}` },
    ],
    DK: [
      { store: "Magasin", url: `https://www.magasin.dk/search?query=${enc}` },
      { store: "Zalando DK", url: `https://www.zalando.dk/katalog/?q=${enc}` },
    ],
    JP: [
      { store: "Zozotown", url: `https://zozo.jp/search/?p_keyword=${enc}` },
      { store: "Amazon.jp", url: `https://www.amazon.co.jp/s?k=${enc}&i=fashion` },
    ],
    SG: [
      { store: "Zalora SG", url: `https://www.zalora.com.sg/search?q=${enc}` },
      { store: "Shopee SG", url: `https://shopee.sg/search?keyword=${enc}` },
    ],
    ZA: [
      { store: "Superbalist", url: `https://superbalist.com/search?q=${enc}` },
      { store: "Takealot", url: `https://www.takealot.com/all?q=${enc}&filter=Category%3AClothing` },
    ],
    BR: [
      { store: "Dafiti", url: `https://www.dafiti.com.br/catalog/?q=${enc}` },
      { store: "Amazon.br", url: `https://www.amazon.com.br/s?k=${enc}&i=fashion` },
    ],
  };

  return [...global, ...(regional[country] ?? [])];
}

export const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "NL", label: "Netherlands" },
  { code: "SE", label: "Sweden" },
  { code: "IT", label: "Italy" },
  { code: "ES", label: "Spain" },
  { code: "NO", label: "Norway" },
  { code: "DK", label: "Denmark" },
  { code: "JP", label: "Japan" },
  { code: "SG", label: "Singapore" },
  { code: "ZA", label: "South Africa" },
  { code: "BR", label: "Brazil" },
  { code: "OTHER", label: "Other" },
];

function buildShopLinks(query: string, country: string): ShopLink[] {
  const enc = encodeURIComponent(query);

  const global: ShopLink[] = [
    {
      store: "IKEA",
      url: `https://www.ikea.com/search/?q=${enc}`,
    },
    {
      store: "Google Shopping",
      url: `https://www.google.com/search?tbm=shop&q=${enc}`,
    },
  ];

  const regional: Record<string, ShopLink[]> = {
    US: [
      { store: "Wayfair", url: `https://www.wayfair.com/keyword.php?keyword=${enc}` },
      { store: "West Elm", url: `https://www.westelm.com/search/results.html?words=${enc}` },
      { store: "CB2", url: `https://www.cb2.com/search?query=${enc}` },
      { store: "Amazon", url: `https://www.amazon.com/s?k=${enc}` },
    ],
    GB: [
      { store: "John Lewis", url: `https://www.johnlewis.com/search?search-term=${enc}` },
      { store: "Habitat", url: `https://www.habitat.co.uk/search?q=${enc}` },
      { store: "Made.com", url: `https://www.made.com/search?q=${enc}` },
      { store: "Amazon UK", url: `https://www.amazon.co.uk/s?k=${enc}` },
    ],
    AU: [
      { store: "Temple & Webster", url: `https://www.templeandwebster.com.au/search?q=${enc}` },
      { store: "Kmart", url: `https://www.kmart.com.au/search?q=${enc}` },
      { store: "Freedom", url: `https://www.freedom.com.au/search?query=${enc}` },
      { store: "Amazon AU", url: `https://www.amazon.com.au/s?k=${enc}` },
    ],
    CA: [
      { store: "Wayfair CA", url: `https://www.wayfair.ca/keyword.php?keyword=${enc}` },
      { store: "Article", url: `https://www.article.com/search?q=${enc}` },
      { store: "Amazon CA", url: `https://www.amazon.ca/s?k=${enc}` },
    ],
    DE: [
      { store: "OTTO", url: `https://www.otto.de/suche/${enc}/` },
      { store: "Home24", url: `https://www.home24.de/search?query=${enc}` },
      { store: "Amazon.de", url: `https://www.amazon.de/s?k=${enc}` },
    ],
    FR: [
      { store: "Maisons du Monde", url: `https://www.maisonsdumonde.com/search?q=${enc}` },
      { store: "La Redoute", url: `https://www.laredoute.fr/recherche/?q=${enc}` },
      { store: "Amazon.fr", url: `https://www.amazon.fr/s?k=${enc}` },
    ],
    NL: [
      { store: "Bol.com", url: `https://www.bol.com/nl/nl/s/?searchtext=${enc}` },
      { store: "FonQ", url: `https://www.fonq.nl/producten/?q=${enc}` },
      { store: "Amazon.nl", url: `https://www.amazon.nl/s?k=${enc}` },
    ],
    SE: [
      { store: "Ellos", url: `https://www.ellos.se/search?query=${enc}` },
      { store: "Hemtex", url: `https://www.hemtex.se/search?q=${enc}` },
    ],
    IT: [
      { store: "Amazon.it", url: `https://www.amazon.it/s?k=${enc}` },
      { store: "Maisons du Monde IT", url: `https://www.maisonsdumonde.com/IT/it/search?q=${enc}` },
    ],
    ES: [
      { store: "Amazon.es", url: `https://www.amazon.es/s?k=${enc}` },
      { store: "El Corte Inglés", url: `https://www.elcorteingles.es/buscar/?s=${enc}` },
    ],
    NO: [
      { store: "Bohus", url: `https://www.bohus.no/search?q=${enc}` },
      { store: "Jollyroom", url: `https://www.jollyroom.no/search?query=${enc}` },
    ],
    DK: [
      { store: "Ilva", url: `https://www.ilva.dk/search?q=${enc}` },
      { store: "Jysk", url: `https://jysk.dk/search?q=${enc}` },
    ],
    JP: [
      { store: "Rakuten", url: `https://search.rakuten.co.jp/search/mall/${enc}/` },
      { store: "Amazon.jp", url: `https://www.amazon.co.jp/s?k=${enc}` },
    ],
    SG: [
      { store: "Lazada SG", url: `https://www.lazada.sg/catalog/?q=${enc}` },
      { store: "Shopee SG", url: `https://shopee.sg/search?keyword=${enc}` },
    ],
    ZA: [
      { store: "Takealot", url: `https://www.takealot.com/all?filter=Category%3AFurniture&q=${enc}` },
      { store: "@Home", url: `https://www.home.co.za/search/?search=${enc}` },
    ],
    BR: [
      { store: "Tok&Stok", url: `https://www.tokstok.com.br/busca?q=${enc}` },
      { store: "Amazon.br", url: `https://www.amazon.com.br/s?k=${enc}` },
    ],
  };

  return [...global, ...(regional[country] ?? [])];
}

const DESIGNER_SYSTEM_PROMPT = `You are OneRoom — an elite AI interior designer and home stager with deep expertise in space planning, color theory, lighting design, furniture curation, and sourcing.

You will receive:
1. A photo of the room
2. The room goal / intended use / vibe description
3. Optional design style preferences
4. The user's country (for regional sourcing context)

Your job:
- Analyze the room's dimensions, natural light quality, existing furniture, flooring, wall colors, architectural features, and overall character.
- Recommend exactly 4 distinct design schemes suited for the described goal.
- Each scheme should have a clear style direction (e.g. "Japandi Warmth", "Bold Maximalist", "Coastal Calm", "Eclectic Workshop", "Wabi-Sabi", "Parisian Chic").
- For each scheme, list 5–8 individual items (sofa, rug, coffee table, lighting, art, plants, accessories, curtains, cushions) with specific colors, materials, and style details.
- Provide a "design note" explaining why this scheme works for this specific room.

Respond ONLY with valid JSON in this exact schema (no markdown, no backticks):
{
  "analysis": "Brief analysis of the room's current state, light quality, and proportions (2-3 sentences)",
  "schemes": [
    {
      "id": 1,
      "title": "Design scheme name",
      "description": "2-sentence overview",
      "designNotes": "Why this works for this specific room",
      "items": [
        {
          "name": "Specific item name with style detail",
          "category": "sofa|chair|table|rug|lighting|storage|art|plant|accessory|bed|shelving|curtain",
          "color": "Specific color",
          "material": "Primary material",
          "searchQuery": "Concise, realistic search query to find this item online"
        }
      ]
    }
  ]
}`;

export async function analyzeAndDesign(
  imageBase64: string,
  goal: string,
  preferences: string,
  country: string,
  apiKey?: string
): Promise<{ analysis: string; schemes: DesignRecommendation[] }> {
  const userMessage = [
    `ROOM GOAL: ${goal}`,
    preferences ? `DESIGN PREFERENCES: ${preferences}` : "No specific preferences — surprise me!",
    `COUNTRY: ${country}`,
  ].join("\n");

  const response = await getClient(apiKey).chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    temperature: 0.8,
    messages: [
      { role: "system", content: DESIGNER_SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: "high" },
          },
          { type: "text", text: userMessage },
        ],
      },
    ],
  });

  const raw = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw);

  const schemes: DesignRecommendation[] = parsed.schemes.map(
    (s: Record<string, unknown>) => ({
      ...s,
      imageUrl: null,
      items: (s.items as Record<string, string>[]).map((item) => ({
        ...item,
        links: buildShopLinks(item.searchQuery, country),
      })),
    })
  );

  return { analysis: parsed.analysis, schemes };
}

export async function generateRoomImage(
  scheme: DesignRecommendation,
  roomImageBase64: string,
  apiKey?: string
): Promise<string> {
  const itemList = scheme.items
    .map((i) => `${i.color} ${i.material} ${i.name}`)
    .join(", ");

  const prompt = [
    `Stage this exact room with the following furniture and decor while preserving the room's architecture, walls, floors, windows, and dimensions exactly.`,
    `Design scheme "${scheme.title}": ${itemList}.`,
    scheme.description,
    `Photorealistic interior photography, natural ambient light, wide-angle lens, professional home staging, editorial quality.`,
  ].join(" ");

  const imageFile = await toFile(
    Buffer.from(roomImageBase64, "base64"),
    "room.png",
    { type: "image/png" }
  );

  const response = await getClient(apiKey).images.edit({
    model: "gpt-image-1",
    image: imageFile,
    prompt,
    n: 1,
    size: "1024x1024",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) return "";
  return `data:image/png;base64,${b64}`;
}
