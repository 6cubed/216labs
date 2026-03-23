import { NextRequest, NextResponse } from "next/server";
import { generateCardImage } from "@/lib/ai";
import { updateCardImage } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { cardId: string; imagePrompt: string };

    const { cardId, imagePrompt } = body;

    if (!cardId || !imagePrompt) {
      return NextResponse.json(
        { error: "cardId and imagePrompt are required" },
        { status: 400 }
      );
    }

    const imageUrl = await generateCardImage(imagePrompt);
    updateCardImage(cardId, imageUrl);

    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[illustrate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
