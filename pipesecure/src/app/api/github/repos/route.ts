import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { listUserRepos } from "@/lib/github";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
    select: { access_token: true },
  });

  if (!account?.access_token) {
    return NextResponse.json({ error: "No GitHub token" }, { status: 400 });
  }

  try {
    const repos = await listUserRepos(account.access_token);
    return NextResponse.json(repos);
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? (error as { status: number }).status
        : 500;

    if (status === 401 || status === 403) {
      return NextResponse.json(
        { error: "GitHub token expired or lacks permissions. Please sign out and sign back in." },
        { status: 403 }
      );
    }

    console.error("Failed to list repos:", error);
    return NextResponse.json({ error: "Failed to list repositories" }, { status: 500 });
  }
}
