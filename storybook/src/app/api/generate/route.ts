import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { generateStory } from "@/lib/ai";
import { saveBook } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      age: number;
      topic: string;
      childName?: string;
    };

    const { age, topic, childName = "" } = body;

    if (!age || !topic) {
      return NextResponse.json(
        { error: "age and topic are required" },
        { status: 400 }
      );
    }

    if (age < 1 || age > 12) {
      return NextResponse.json(
        { error: "age must be between 1 and 12" },
        { status: 400 }
      );
    }

    const generated = await generateStory(age, topic, childName);

    const bookId = uuidv4();
    const now = new Date().toISOString();

    const pages = generated.pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      imagePrompt: p.imagePrompt,
      imageUrl: null,
    }));

    saveBook({
      id: bookId,
      title: generated.title,
      subtitle: generated.subtitle,
      childName,
      age,
      topic,
      pages,
      createdAt: now,
    });

    return NextResponse.json({
      bookId,
      title: generated.title,
      subtitle: generated.subtitle,
      characterDescription: generated.characterDescription,
      pages: generated.pages,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
