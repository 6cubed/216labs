import { NextRequest, NextResponse } from "next/server";
import { generatePageImage } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      imagePrompt: string;
      characterDescription: string;
      age: number;
    };

    const { imagePrompt, characterDescription, age } = body;

    if (!imagePrompt || !characterDescription) {
      return NextResponse.json(
        { error: "imagePrompt and characterDescription are required" },
        { status: 400 }
      );
    }

    const imageUrl = await generatePageImage(imagePrompt, characterDescription, age);

    return NextResponse.json({ imageUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[illustrate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
