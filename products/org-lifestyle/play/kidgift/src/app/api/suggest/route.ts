import { NextRequest, NextResponse } from "next/server";
import {
  curatedGifts,
  STORYMAGIC_UPSELL,
  type Budget,
  type GiftIdea,
} from "@/lib/gifts";

export const dynamic = "force-dynamic";

type Body = {
  age?: number;
  interests?: string[];
  budget?: Budget;
};

async function aiGifts(
  age: number,
  interests: string[],
  budget: Budget
): Promise<GiftIdea[] | null> {
  const key =
    process.env.KIDGIFT_OPENAI_API_KEY?.trim() ||
    process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const budgetLabel =
    budget === "under25" ? "under $25" : budget === "25to50" ? "$25–50" : "$50+";

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            'Return JSON: {"gifts":[{"name":"...","why":"...","priceHint":"$X–Y","tag":"..."}]} with exactly 5 kid gift ideas. No brand names. Age-appropriate, specific, concise.',
        },
        {
          role: "user",
          content: `Child age ${age}. Interests: ${interests.join(", ") || "general"}. Budget: ${budgetLabel}.`,
        },
      ],
    }),
  });

  if (!res.ok) return null;
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { gifts?: GiftIdea[] };
    if (!Array.isArray(parsed.gifts) || parsed.gifts.length === 0) return null;
    return parsed.gifts.slice(0, 5).map((g) => ({
      name: String(g.name ?? "").slice(0, 120),
      why: String(g.why ?? "").slice(0, 280),
      priceHint: String(g.priceHint ?? "").slice(0, 40),
      tag: g.tag ? String(g.tag).slice(0, 32) : "AI pick",
    }));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const age = typeof body.age === "number" ? Math.round(body.age) : 7;
  const safeAge = Math.min(12, Math.max(1, age));
  const interests = Array.isArray(body.interests)
    ? body.interests.filter((x) => typeof x === "string").slice(0, 6)
    : [];
  const budget: Budget =
    body.budget === "under25" || body.budget === "50plus" || body.budget === "25to50"
      ? body.budget
      : "25to50";

  const ai = await aiGifts(safeAge, interests, budget);
  const gifts = ai ?? curatedGifts(safeAge, interests, budget);
  const source = ai ? "openai" : "curated";

  return NextResponse.json({
    ok: true,
    age: safeAge,
    interests,
    budget,
    source,
    gifts,
    storymagic: STORYMAGIC_UPSELL,
  });
}
