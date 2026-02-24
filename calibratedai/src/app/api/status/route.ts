import { NextResponse } from "next/server";
import { refreshState } from "@/lib/refresh-state";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(refreshState);
}
