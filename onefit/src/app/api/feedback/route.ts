import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { saveFeedback, getUserFeedback } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { outfitTitle, outfitJson, vote, occasion } = await req.json();
  if (!outfitTitle || !outfitJson || !vote) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (vote !== "up" && vote !== "down") {
    return NextResponse.json({ error: "Vote must be 'up' or 'down'" }, { status: 400 });
  }

  saveFeedback(
    auth.userId,
    outfitTitle,
    typeof outfitJson === "string" ? outfitJson : JSON.stringify(outfitJson),
    vote,
    occasion
  );

  return NextResponse.json({ ok: true });
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const feedback = getUserFeedback(auth.userId);
  return NextResponse.json({ feedback });
}
