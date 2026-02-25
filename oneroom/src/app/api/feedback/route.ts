import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { saveFeedback, getUserFeedback } from "@/lib/db";

export async function POST(req: NextRequest) {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { schemeTitle, schemeJson, vote, roomGoal } = await req.json();
  if (!schemeTitle || !schemeJson || !vote) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (vote !== "up" && vote !== "down") {
    return NextResponse.json({ error: "Vote must be 'up' or 'down'" }, { status: 400 });
  }

  saveFeedback(
    auth.userId,
    schemeTitle,
    typeof schemeJson === "string" ? schemeJson : JSON.stringify(schemeJson),
    vote,
    roomGoal
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
