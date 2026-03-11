import { NextResponse } from "next/server";
import { LESSON_TOPICS } from "@/lib/prompts";
import { getAllProgress } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const progress = getAllProgress();
    const progressMap = Object.fromEntries(
      progress.map((p) => [p.topic_id, p])
    );

    const topics = LESSON_TOPICS.map((topic) => ({
      ...topic,
      progress: progressMap[topic.id] ?? null,
    }));

    return NextResponse.json({ topics });
  } catch (err) {
    console.error("[lessons/route]", err);
    return NextResponse.json({ error: "Failed to load lessons." }, { status: 500 });
  }
}
