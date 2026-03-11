import { NextRequest, NextResponse } from "next/server";
import { streamChat, ChatMessage } from "@/lib/openai";
import { getConversationSystemPrompt, getLessonSystemPrompt, LESSON_TOPICS } from "@/lib/prompts";
import { createSession, getSession, addMessage, getMessages } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message,
      mode,
      topicId,
      sessionId: existingSessionId,
    }: {
      message: string;
      mode: "conversation" | "lesson";
      topicId?: string;
      sessionId?: string;
    } = body;

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    // Resolve or create session
    let sessionId = existingSessionId;
    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) sessionId = undefined;
    }
    if (!sessionId) {
      sessionId = createSession(mode, topicId);
    }

    // Build system prompt
    let systemPrompt: string;
    if (mode === "lesson" && topicId) {
      const topic = LESSON_TOPICS.find((t) => t.id === topicId);
      systemPrompt = getLessonSystemPrompt(topicId, topic?.titleEn ?? topicId);
    } else {
      systemPrompt = getConversationSystemPrompt();
    }

    // Build message history
    const history = getMessages(sessionId);
    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    // Save user message
    addMessage(sessionId, "user", message);

    // Stream response from GPT-4o
    const stream = await streamChat(messages);

    // Accumulate the full response in the background so we can persist it
    const [streamForClient, streamForStorage] = stream.tee();

    (async () => {
      const decoder = new TextDecoder();
      const reader = streamForStorage.getReader();
      let fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullContent += decoder.decode(value, { stream: true });
      }
      if (fullContent) {
        addMessage(sessionId!, "assistant", fullContent);
      }
    })().catch(console.error);

    return new Response(streamForClient, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Session-Id": sessionId,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[chat/route]", err);
    return NextResponse.json(
      { error: "Failed to generate response." },
      { status: 500 }
    );
  }
}
