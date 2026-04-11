import { NextResponse } from "next/server";
import { z } from "zod";
import { chatModel, getOpenAI } from "@/lib/openai";
import { webSearch } from "@/lib/search";
import {
  deriveTitleFromMessage,
  newMessageId,
  readSession,
  writeSession,
} from "@/lib/sessions";
import type { ChatMessage, Session, Source } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  sessionId: z.string().uuid().optional(),
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string().max(32000),
    })
  ),
  searchDepth: z.enum(["basic", "advanced"]).optional(),
});

function ndjson(obj: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(obj) + "\n");
}

async function buildSearchQuery(
  messages: Array<{ role: "user" | "assistant"; content: string }>
): Promise<string> {
  const users = messages.filter((m) => m.role === "user");
  const last = users.pop()?.content?.trim();
  if (!last) throw new Error("No user message");
  if (messages.filter((m) => m.role === "user").length <= 1) return last;

  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: chatModel(),
    messages: [
      {
        role: "system",
        content:
          "You output exactly one short web search query (max 18 words) to find current information for the user's latest request. Consider prior turns. No quotes, no explanation—query text only.",
      },
      ...messages.slice(-10).map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, 8000),
      })),
    ],
    max_tokens: 80,
    temperature: 0.3,
  });
  const q = completion.choices[0]?.message?.content?.trim();
  return q && q.length > 0 ? q.replace(/^["']|["']$/g, "") : last;
}

async function relatedQuestions(
  query: string,
  answerSummary: string
): Promise<string[]> {
  const openai = getOpenAI();
  const completion = await openai.chat.completions.create({
    model: chatModel(),
    messages: [
      {
        role: "system",
        content:
          'Return JSON only: {"questions":["short follow-up 1","short follow-up 2","short follow-up 3"]} — diverse, specific, answerable with web search.',
      },
      {
        role: "user",
        content: `Original topic: ${query.slice(0, 500)}\n\nAnswer excerpt: ${answerSummary.slice(0, 1200)}`,
      },
    ],
    max_tokens: 200,
    response_format: { type: "json_object" },
    temperature: 0.5,
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { questions?: string[] };
    const qs = parsed.questions?.filter((q) => typeof q === "string").slice(0, 5);
    return qs?.length ? qs.slice(0, 3) : [];
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { messages, sessionId: incomingSessionId } = parsed.data;
  if (messages.length === 0) {
    return NextResponse.json({ error: "messages required" }, { status: 400 });
  }
  const last = messages[messages.length - 1];
  if (last.role !== "user") {
    return NextResponse.json({ error: "Last message must be from user" }, { status: 400 });
  }

  const openai = getOpenAI();
  const encoder = new TextEncoder();

  let sources: Source[] = [];
  let searchQuery = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (obj: unknown) => controller.enqueue(ndjson(obj));

      try {
        searchQuery = await buildSearchQuery(messages);
        sources = await webSearch(searchQuery, { maxResults: 8 });
        push({ type: "sources", sources });

        const sourceBlock = sources
          .map(
            (s, i) =>
              `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}\n`
          )
          .join("\n");

        const system = `You are a helpful research assistant (Perplexity-style). Answer using the numbered web sources below. When you use a fact from source i, add an inline citation in square brackets with that number, e.g. [1] or [2]. Use multiple citations when appropriate. If sources conflict, say so. If the sources do not contain enough information, say what is missing and what would need to be checked. Write in clear Markdown (headings allowed). Be concise but thorough.

Sources:
${sourceBlock}`;

        const chatMessages = [
          { role: "system" as const, content: system },
          ...messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
        ];

        const llmStream = await openai.chat.completions.create({
          model: chatModel(),
          messages: chatMessages,
          stream: true,
          max_tokens: 4096,
          temperature: 0.35,
        });

        let full = "";
        for await (const part of llmStream) {
          const token = part.choices[0]?.delta?.content ?? "";
          if (token) {
            full += token;
            push({ type: "token", text: token });
          }
        }

        const related = await relatedQuestions(searchQuery, full.slice(0, 2000));
        push({ type: "related", questions: related });

        const now = new Date().toISOString();
        const sid = incomingSessionId ?? crypto.randomUUID();
        let session: Session | null = incomingSessionId
          ? await readSession(incomingSessionId)
          : null;

        const userMsg: ChatMessage = {
          id: newMessageId(),
          role: "user",
          content: last.content,
          createdAt: now,
        };
        const assistantMsg: ChatMessage = {
          id: newMessageId(),
          role: "assistant",
          content: full,
          sources,
          related,
          createdAt: now,
        };

        let base = session?.messages ?? [];
        while (
          base.length > 0 &&
          base[base.length - 1]!.role === "user" &&
          base[base.length - 1]!.content === last.content
        ) {
          base = base.slice(0, -1);
        }

        session = {
          id: sid,
          title: session?.title || deriveTitleFromMessage(last.content),
          messages: [...base, userMsg, assistantMsg],
          updatedAt: now,
        };
        await writeSession(session);

        push({ type: "done", sessionId: sid, searchQuery });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        controller.enqueue(ndjson({ type: "error", message: msg }));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
