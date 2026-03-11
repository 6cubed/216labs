import { NextResponse } from "next/server";
import { getRecentSubmissions } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const submissions = getRecentSubmissions(30);
    return NextResponse.json({ submissions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
