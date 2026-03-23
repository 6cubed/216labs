import OpenAI, { toFile } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

type LLMProvider = "openai" | "gemini";

function getActiveProvider(): LLMProvider {
  return process.env.LLM_PROVIDER === "gemini" ? "gemini" : "openai";
}

function getOpenAIClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is required. Please enter your key above.");
  return new OpenAI({ apiKey: key });
}

function getGeminiClient(apiKey?: string): GoogleGenerativeAI {
  const key = apiKey || process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API key is required. Please enter your key above.");
  return new GoogleGenerativeAI(key);
}

export interface OutfitRecommendation {
  id: number;
  title: string;
  description: string;
  items: ProductItem[];
  imageUrl: string | null;
  styleNotes: string;
}

export interface ProductItem {
  name: string;
  category: string;
  color: string;
  searchQuery: string;
  links: ShopLink[];
}

export interface ShopLink {
  store: string;
  url: string;
}

function buildShopLinks(query: string): ShopLink[] {
  const encoded = encodeURIComponent(query);
  return [
    {
      store: "Google Shopping",
      url: `https://www.google.com/search?tbm=shop&q=${encoded}`,
    },
    {
      store: "Amazon",
      url: `https://www.amazon.com/s?k=${encoded}`,
    },
    {
      store: "ASOS",
      url: `https://www.asos.com/search/?q=${encoded}`,
    },
    {
      store: "Nordstrom",
      url: `https://www.nordstrom.com/sr?keyword=${encoded}`,
    },
  ];
}

const STYLIST_SYSTEM_PROMPT = `You are OneFit — an elite personal stylist AI with deep expertise in fashion, color theory, body proportions, and occasion-appropriate dressing.

You will receive:
1. An image of the person
2. The occasion / theme / event description
3. Optional style preferences

Your job:
- Analyze the person's apparent body shape, skin tone, and current style cues from the photo.
- Recommend exactly 4 distinct outfits suited for the described occasion.
- Each outfit should have a clear style direction (e.g. "Modern Minimalist", "Bold Statement", "Effortless Chic", "Classic Elegance").
- For each outfit, list 3-5 individual clothing items with specific colors, materials, and style details.
- Provide a brief "style note" explaining why this outfit works for this person and occasion.

Respond ONLY with valid JSON in this exact schema (no markdown, no backticks):
{
  "analysis": "Brief analysis of the person's features and style (2-3 sentences)",
  "outfits": [
    {
      "id": 1,
      "title": "Outfit theme name",
      "description": "2-sentence outfit overview",
      "styleNotes": "Why this works for this person + occasion",
      "items": [
        {
          "name": "Specific item name with brand-style detail",
          "category": "top|bottom|shoes|accessory|outerwear|dress",
          "color": "Specific color",
          "searchQuery": "Concise, realistic search query to find this item online"
        }
      ]
    }
  ]
}`;

async function analyzeAndRecommendOpenAI(
  imageBase64: string,
  occasion: string,
  preferences: string,
  apiKey?: string
): Promise<{ analysis: string; outfits: OutfitRecommendation[] }> {
  const userMessage = `OCCASION: ${occasion}\n${preferences ? `STYLE PREFERENCES: ${preferences}` : "No specific preferences — surprise me!"}`;

  const response = await getOpenAIClient(apiKey).chat.completions.create({
    model: "gpt-4o",
    max_tokens: 4000,
    temperature: 0.8,
    messages: [
      { role: "system", content: STYLIST_SYSTEM_PROMPT },
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
  return parseOutfitResponse(raw);
}

async function analyzeAndRecommendGemini(
  imageBase64: string,
  occasion: string,
  preferences: string,
  apiKey?: string
): Promise<{ analysis: string; outfits: OutfitRecommendation[] }> {
  const userMessage = `OCCASION: ${occasion}\n${preferences ? `STYLE PREFERENCES: ${preferences}` : "No specific preferences — surprise me!"}`;

  const model = getGeminiClient(apiKey).getGenerativeModel({
    model: "gemini-2.0-flash",
    generationConfig: { temperature: 0.8, maxOutputTokens: 4000 },
  });

  const result = await model.generateContent([
    { text: STYLIST_SYSTEM_PROMPT + "\n\n" + userMessage },
    { inlineData: { mimeType: "image/jpeg", data: imageBase64 } },
  ]);

  const raw = result.response.text();
  // Strip markdown fences Gemini may wrap around JSON
  const json = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
  return parseOutfitResponse(json);
}

function parseOutfitResponse(
  raw: string
): { analysis: string; outfits: OutfitRecommendation[] } {
  const parsed = JSON.parse(raw);

  const outfits: OutfitRecommendation[] = parsed.outfits.map(
    (o: Record<string, unknown>) => ({
      ...o,
      imageUrl: null,
      items: (o.items as Record<string, string>[]).map((item) => ({
        ...item,
        links: buildShopLinks(item.searchQuery),
      })),
    })
  );

  return { analysis: parsed.analysis, outfits };
}

export async function analyzeAndRecommend(
  imageBase64: string,
  occasion: string,
  preferences: string,
  apiKey?: string
): Promise<{ analysis: string; outfits: OutfitRecommendation[] }> {
  if (getActiveProvider() === "gemini") {
    return analyzeAndRecommendGemini(imageBase64, occasion, preferences, apiKey);
  }
  return analyzeAndRecommendOpenAI(imageBase64, occasion, preferences, apiKey);
}

export async function generateOutfitImage(
  outfit: OutfitRecommendation,
  personImageBase64: string,
  apiKey?: string
): Promise<string> {
  const itemList = outfit.items
    .map((i) => `${i.color} ${i.name}`)
    .join(", ");

  const prompt = [
    `Transform this photo: dress this exact person in the following outfit while preserving their face, body type, hair, and skin tone exactly.`,
    `Outfit "${outfit.title}": ${itemList}.`,
    outfit.description,
    `Full-body shot, photorealistic, editorial fashion photography, studio lighting, clean minimal background.`,
  ].join(" ");

  const imageFile = await toFile(
    Buffer.from(personImageBase64, "base64"),
    "person.png",
    { type: "image/png" }
  );

  const response = await getOpenAIClient(apiKey).images.edit({
    model: "gpt-image-1",
    image: imageFile,
    prompt,
    n: 1,
    size: "1024x1536",
  });

  const b64 = response.data?.[0]?.b64_json;
  if (!b64) return "";
  return `data:image/png;base64,${b64}`;
}
