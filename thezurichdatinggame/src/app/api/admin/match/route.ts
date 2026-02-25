import { NextRequest, NextResponse } from "next/server";
import { getAllParticipants, insertMatch, getMatchCount } from "@/lib/db";

const ADMIN_KEY = process.env.ZDGAME_ADMIN_KEY || "change-me";
const OPENROUTER_API_KEY = process.env.ZDGAME_OPENROUTER_API_KEY || "";
const MODEL =
  process.env.ZDGAME_MODEL || "google/gemini-2.0-flash-001";

type Participant = {
  id: number;
  name: string;
  age: number;
  gender: string;
  interested_in: string;
  occupation: string | null;
  neighborhood: string | null;
  bio: string;
  three_things: string;
  perfect_date: string;
};

async function getAIMatch(
  person: Participant,
  candidates: Participant[]
): Promise<{ matchId: number; reasoning: string } | null> {
  if (candidates.length === 0) return null;

  const profileSummary = (p: Participant) =>
    `Name: ${p.name}, Age: ${p.age}, Gender: ${p.gender}, Interested in: ${p.interested_in}` +
    (p.occupation ? `, Occupation: ${p.occupation}` : "") +
    (p.neighborhood ? `, Neighborhood: ${p.neighborhood}` : "") +
    `\nAbout: ${p.bio}` +
    `\nThree things they can't live without: ${p.three_things}` +
    `\nPerfect first date: ${p.perfect_date}`;

  const prompt = `You are an expert matchmaker for The Zurich Dating Game, a dating event in Zurich, Switzerland.

Your task is to find the BEST romantic match for Person A from the list of candidates below.

PERSON A:
${profileSummary(person)}

CANDIDATES:
${candidates.map((c, i) => `--- Candidate ${i + 1} (ID: ${c.id}) ---\n${profileSummary(c)}`).join("\n\n")}

Instructions:
1. Consider compatibility in values, interests, lifestyle, and what they're looking for.
2. Consider practical factors like age range preferences and neighborhood proximity.
3. Choose the SINGLE best match from the candidates list.
4. Respond with valid JSON only — no markdown, no extra text.

Response format:
{"match_id": <candidate id>, "reasoning": "<2-3 sentences explaining why this is a great match>"}`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "HTTP-Referer": "https://thezurichdatinggame.com",
        "X-Title": "The Zurich Dating Game",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 300,
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} ${text}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? "";

  const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const parsed = JSON.parse(cleaned);
  return {
    matchId: parsed.match_id,
    reasoning: parsed.reasoning,
  };
}

export async function POST(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!OPENROUTER_API_KEY) {
    return NextResponse.json(
      { error: "OpenRouter API key not configured." },
      { status: 500 }
    );
  }

  const existingMatches = getMatchCount();
  if (existingMatches > 0) {
    return NextResponse.json(
      { error: "Matches have already been generated.", count: existingMatches },
      { status: 409 }
    );
  }

  const participants = getAllParticipants();
  if (participants.length < 2) {
    return NextResponse.json(
      { error: "Not enough participants to generate matches.", count: participants.length },
      { status: 400 }
    );
  }

  const matched = new Set<number>();
  const results: Array<{
    person: string;
    match: string;
    reasoning: string;
  }> = [];
  const errors: string[] = [];

  for (const person of participants) {
    if (matched.has(person.id)) continue;

    const candidates = participants.filter((p) => {
      if (p.id === person.id) return false;
      if (matched.has(p.id)) return false;

      const personWants = person.interested_in.toLowerCase();
      const candidateGender = p.gender.toLowerCase();
      const candidateWants = p.interested_in.toLowerCase();
      const personGender = person.gender.toLowerCase();

      const personWantsCandidate =
        personWants === "everyone" ||
        candidateGender.startsWith(personWants.slice(0, -1)) ||
        candidateGender === personWants.replace(/s$/, "");

      const candidateWantsPerson =
        candidateWants === "everyone" ||
        personGender.startsWith(candidateWants.slice(0, -1)) ||
        personGender === candidateWants.replace(/s$/, "");

      return personWantsCandidate && candidateWantsPerson;
    });

    if (candidates.length === 0) continue;

    try {
      const result = await getAIMatch(person, candidates);
      if (!result) continue;

      const matchedPerson = candidates.find((c) => c.id === result.matchId);
      if (!matchedPerson) continue;

      insertMatch(person.id, matchedPerson.id, result.reasoning);
      matched.add(person.id);
      matched.add(matchedPerson.id);

      results.push({
        person: person.name,
        match: matchedPerson.name,
        reasoning: result.reasoning,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to match ${person.name}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    matches_created: results.length,
    unmatched: participants.length - matched.size,
    results,
    errors,
  });
}

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-admin-key");
  if (key !== ADMIN_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participants = getAllParticipants();
  const matchCount = getMatchCount();

  return NextResponse.json({
    participants: participants.length,
    matches: matchCount,
    list: participants.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      interested_in: p.interested_in,
      neighborhood: p.neighborhood,
      joined: p.created_at,
    })),
  });
}
