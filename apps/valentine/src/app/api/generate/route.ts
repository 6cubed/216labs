import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateCardCopy } from "@/lib/ai";
import { saveCard } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      idea: string;
      recipientName?: string;
      tone?: string;
    };

    const { idea, recipientName = "", tone = "romantic" } = body;

    if (!idea?.trim()) {
      return NextResponse.json({ error: "idea is required" }, { status: 400 });
    }

    const validTones = ["romantic", "playful", "poetic", "funny"];
    const t = validTones.includes(tone) ? tone : "romantic";

    const generated = await generateCardCopy(idea.trim(), recipientName.trim(), t);

    const cardId = uuidv4();
    const now = new Date().toISOString();

    saveCard({
      id: cardId,
      title: generated.title,
      insideMessage: generated.insideMessage,
      recipientName: recipientName.trim(),
      idea: idea.trim(),
      tone: t,
      imagePrompt: generated.imagePrompt,
      imageUrl: null,
      createdAt: now,
    });

    return NextResponse.json({
      cardId,
      title: generated.title,
      insideMessage: generated.insideMessage,
      imagePrompt: generated.imagePrompt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
