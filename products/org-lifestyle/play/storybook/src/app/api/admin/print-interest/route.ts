import { NextRequest, NextResponse } from "next/server";
import { getAllPrintInterests } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.STORYBOOK_ADMIN_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getAllPrintInterests());
}
