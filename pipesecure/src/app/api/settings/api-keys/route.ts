import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true,
      provider: true,
      label: true,
      createdAt: true,
      encryptedKey: true,
    },
  });

  const masked = keys.map((k) => {
    let maskedKey = "••••••••";
    try {
      const raw = decrypt(k.encryptedKey);
      maskedKey = raw.slice(0, 7) + "••••" + raw.slice(-4);
    } catch {
      // can't decrypt, show generic mask
    }
    return {
      id: k.id,
      provider: k.provider,
      label: k.label,
      maskedKey,
      createdAt: k.createdAt,
    };
  });

  return NextResponse.json(masked);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { apiKey, provider, label } = body;

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json({ error: "apiKey is required" }, { status: 400 });
  }

  const encryptedKey = encrypt(apiKey);

  const key = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      provider: provider || "openai",
      label: label || "Default",
      encryptedKey,
    },
  });

  return NextResponse.json({ id: key.id, provider: key.provider, label: key.label }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const keyId = searchParams.get("id");

  if (!keyId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.apiKey.deleteMany({
    where: { id: keyId, userId: session.user.id },
  });

  return NextResponse.json({ deleted: true });
}
