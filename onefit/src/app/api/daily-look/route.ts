import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getUserFeedback, getDailyLook, saveDailyLook } from "@/lib/db";
import OpenAI from "openai";

function getClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is required");
  return new OpenAI({ apiKey: key });
}

function buildShopLinks(query: string) {
  const encoded = encodeURIComponent(query);
  return [
    { store: "Google Shopping", url: `https://www.google.com/search?tbm=shop&q=${encoded}` },
    { store: "Amazon", url: `https://www.amazon.com/s?k=${encoded}` },
    { store: "ASOS", url: `https://www.asos.com/search/?q=${encoded}` },
    { store: "Nordstrom", url: `https://www.nordstrom.com/sr?keyword=${encoded}` },
  ];
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

const DAILY_PROMPT = `You are OneFit's daily stylist. Based on the user's style feedback history, generate ONE outfit recommendation for today.

The user has rated outfits before:
LIKED (thumbs up):
{liked}

DISLIKED (thumbs down):
{disliked}

Today is {date} ({dayOfWeek}). Consider the season and day when choosing formality.

Generate a single outfit that aligns with their demonstrated preferences. If they have no history yet, create a versatile, crowd-pleasing look.

Respond ONLY with valid JSON (no markdown):
{
  "title": "Outfit name",
  "description": "2-sentence overview",
  "styleNotes": "Why this suits their taste",
  "styleProfile": "2-sentence summary of the user's emerging style identity based on their feedback patterns",
  "items": [
    {
      "name": "Specific item",
      "category": "top|bottom|shoes|accessory|outerwear|dress",
      "color": "Specific color",
      "searchQuery": "Search query to find this online"
    }
  ]
}`;

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const regenerate = body.regenerate === true;
  const apiKey = body.apiKey as string | undefined;
  const date = todayStr();

  if (!regenerate) {
    const cached = getDailyLook(auth.userId, date);
    if (cached) {
      const outfit = JSON.parse(cached.outfit_json);
      return NextResponse.json({
        date,
        outfit,
        styleProfile: cached.style_profile,
        isNew: false,
      });
    }
  }

  const feedback = getUserFeedback(auth.userId);
  const liked = feedback
    .filter((f) => f.vote === "up")
    .map((f) => f.outfit_title)
    .slice(0, 10)
    .join(", ") || "None yet";
  const disliked = feedback
    .filter((f) => f.vote === "down")
    .map((f) => f.outfit_title)
    .slice(0, 10)
    .join(", ") || "None yet";

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = days[new Date().getDay()];

  const prompt = DAILY_PROMPT
    .replace("{liked}", liked)
    .replace("{disliked}", disliked)
    .replace("{date}", date)
    .replace("{dayOfWeek}", dayOfWeek);

  try {
    const response = await getClient(apiKey).chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      temperature: 0.9,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const outfit = {
      ...parsed,
      items: parsed.items.map((item: Record<string, string>) => ({
        ...item,
        links: buildShopLinks(item.searchQuery),
      })),
    };

    saveDailyLook(auth.userId, date, JSON.stringify(outfit), parsed.styleProfile ?? "");

    return NextResponse.json({
      date,
      outfit,
      styleProfile: parsed.styleProfile,
      isNew: true,
    });
  } catch (err) {
    console.error("Daily look error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate daily look";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
