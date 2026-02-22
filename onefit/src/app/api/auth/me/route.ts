import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) {
    return NextResponse.json({ user: null });
  }

  const user = getUserById(auth.userId);
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
}
