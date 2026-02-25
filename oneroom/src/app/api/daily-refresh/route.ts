import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getUserFeedback, getDailyRefresh, saveDailyRefresh } from "@/lib/db";
import { buildFashionLinks } from "@/lib/openai";
import OpenAI from "openai";

function getClient(apiKey?: string): OpenAI {
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OpenAI API key is required");
  return new OpenAI({ apiKey: key });
}

function todayStr() {
  return new Date().toISOString().split("T")[0];
}

function getSeason(month: number, hemisphere: "north" | "south"): string {
  const seasons =
    hemisphere === "north"
      ? ["Winter", "Winter", "Spring", "Spring", "Spring", "Summer", "Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter"]
      : ["Summer", "Summer", "Autumn", "Autumn", "Autumn", "Winter", "Winter", "Winter", "Spring", "Spring", "Spring", "Summer"];
  return seasons[month];
}

const SOUTHERN_HEMISPHERE = new Set(["AU", "NZ", "ZA", "BR", "AR", "CL", "PE"]);

const OUTFIT_PROMPT = `You are a bold, experimental fashion stylist with an eye for the unexpected. Generate ONE completely random outfit look for today.

Think outside safe choices. Mix aesthetics freely: streetwear with tailoring, vintage with futurism, workwear with romance, quiet luxury with maximalism. Every look should feel editorial and fresh.

Random inspiration seed: {randomSeed}
Today: {date} ({dayOfWeek}) — Season: {season}
Country: {country}
User: {name}

Past liked styles (use as loose inspiration, not strict template):
{liked}

Past disliked styles (actively avoid these aesthetics):
{disliked}

Generate a look with 5–7 specific items. Be precise with colors, textures, and silhouettes. Name the look with something catchy and editorial.

Respond ONLY with valid JSON (no markdown):
{
  "title": "Editorial look name",
  "description": "2-sentence punchy overview of the total vibe",
  "styleNotes": "Specific styling tips: how to wear it, what occasion it suits, key proportions",
  "styleProfile": "2-sentence summary of this user's emerging personal style based on their preferences",
  "items": [
    {
      "name": "Specific item with detail (e.g. Oversized blazer with peak lapels)",
      "category": "top|bottom|dress|outerwear|shoes|bag|accessory|jewelry|activewear",
      "color": "Specific shade (e.g. dusty mauve, cobalt, off-white)",
      "material": "Primary material or texture",
      "searchQuery": "Realistic search query to find this item online"
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
  const country = (body.country as string) ?? "US";
  const userName = body.userName as string | undefined;
  const date = todayStr();

  if (!regenerate) {
    const cached = getDailyRefresh(auth.userId, date);
    if (cached) {
      const scheme = JSON.parse(cached.scheme_json);
      return NextResponse.json({
        date,
        scheme,
        styleProfile: cached.design_profile,
        isNew: false,
      });
    }
  }

  const feedback = getUserFeedback(auth.userId);
  const liked = feedback
    .filter((f) => f.vote === "up")
    .map((f) => f.scheme_title)
    .slice(0, 8)
    .join(", ") || "No preferences saved yet";
  const disliked = feedback
    .filter((f) => f.vote === "down")
    .map((f) => f.scheme_title)
    .slice(0, 8)
    .join(", ") || "None";

  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayOfWeek = days[new Date().getDay()];
  const month = new Date().getMonth();
  const hemisphere = SOUTHERN_HEMISPHERE.has(country) ? "south" : "north";
  const season = getSeason(month, hemisphere);

  // Random seed for high variance — different every call
  const randomSeed = Math.floor(Math.random() * 999983).toString();

  const prompt = OUTFIT_PROMPT
    .replace("{randomSeed}", randomSeed)
    .replace("{liked}", liked)
    .replace("{disliked}", disliked)
    .replace("{date}", date)
    .replace("{dayOfWeek}", dayOfWeek)
    .replace("{season}", season)
    .replace("{country}", country)
    .replace("{name}", userName ?? "the user");

  try {
    const response = await getClient(apiKey).chat.completions.create({
      model: "gpt-4o",
      max_tokens: 2000,
      temperature: 1.2,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    const scheme = {
      ...parsed,
      items: parsed.items.map((item: Record<string, string>) => ({
        ...item,
        links: buildFashionLinks(item.searchQuery, country),
      })),
    };

    saveDailyRefresh(auth.userId, date, JSON.stringify(scheme), parsed.styleProfile ?? "");

    return NextResponse.json({
      date,
      scheme,
      styleProfile: parsed.styleProfile,
      isNew: true,
    });
  } catch (err) {
    console.error("Daily look error:", err);
    const message = err instanceof Error ? err.message : "Failed to generate daily look";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
