import { NextResponse } from "next/server";
import {
  buildGroundedSystemPrompt,
  buildUserPrompt,
  DEFAULT_CHARACTERS,
  DEFAULT_SERIES,
  type GenerateFormat,
  getCharactersByIds,
  type TvCharacter,
} from "@/lib/tv-studio";
import { getEnvVarValue } from "@/lib/db";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  episodeTitle?: string;
  premise?: string;
  beatNotes?: string;
  characterIds?: string[];
  format?: GenerateFormat;
  /** Optional full character list from client import (JSON). */
  characters?: TvCharacter[];
};

function resolveApiKey(): { kind: "openai" | "openrouter"; key: string } | null {
  const procOpenAi = process.env.OPENAI_API_KEY?.trim();
  const procRouter = process.env.OPENROUTER_API_KEY?.trim();
  const dbOpenAi = getEnvVarValue("OPENAI_API_KEY");
  const dbRouter = getEnvVarValue("OPENROUTER_API_KEY");
  const router = procRouter || dbRouter;
  const openai = procOpenAi || dbOpenAi;
  if (router) return { kind: "openrouter", key: router };
  if (openai) return { kind: "openai", key: openai };
  return null;
}

function resolveModel(kind: "openai" | "openrouter"): string {
  const custom =
    process.env.ADMIN_TV_STUDIO_MODEL?.trim() ||
    getEnvVarValue("ADMIN_TV_STUDIO_MODEL");
  if (custom) return custom;
  return kind === "openai" ? "gpt-4o-mini" : "google/gemini-2.0-flash-001";
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const episodeTitle = (body.episodeTitle ?? "").trim();
  const premise = (body.premise ?? "").trim();
  if (!episodeTitle || !premise) {
    return NextResponse.json(
      { error: "episodeTitle and premise are required" },
      { status: 400 }
    );
  }

  const format: GenerateFormat =
    body.format === "beat_sheet" || body.format === "shot_list" || body.format === "dialogue_scenes"
      ? body.format
      : "beat_sheet";

  const roster: TvCharacter[] =
    Array.isArray(body.characters) && body.characters.length > 0
      ? body.characters
      : DEFAULT_CHARACTERS;

  const ids = Array.isArray(body.characterIds) ? body.characterIds : [];
  const cast = ids.length > 0 ? getCharactersByIds(roster, ids) : roster;

  const api = resolveApiKey();
  if (!api) {
    return NextResponse.json(
      {
        error:
          "No LLM key configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY in process env or admin env_vars.",
      },
      { status: 503 }
    );
  }

  const model = resolveModel(api.kind);
  const system = buildGroundedSystemPrompt(DEFAULT_SERIES, cast, format);
  const user = buildUserPrompt({ episodeTitle, premise, beatNotes: body.beatNotes });

  const url =
    api.kind === "openai"
      ? "https://api.openai.com/v1/chat/completions"
      : "https://openrouter.ai/api/v1/chat/completions";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${api.key}`,
  };
  if (api.kind === "openrouter") {
    headers["HTTP-Referer"] = "https://admin.6cubed.app";
    headers["X-Title"] = "216Labs Admin TV Studio";
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.65,
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    return NextResponse.json(
      { error: `LLM request failed (${res.status})`, detail: errText.slice(0, 500) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "Empty model response" }, { status: 502 });
  }

  return NextResponse.json({
    text,
    model,
    provider: api.kind,
    seriesId: DEFAULT_SERIES.id,
    castIds: cast.map((c) => c.id),
  });
}
