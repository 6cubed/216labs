import { NextResponse } from "next/server";
import { registerWorker } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    webgpu?: boolean;
  };

  const ua = req.headers.get("user-agent") || undefined;
  const res = await registerWorker({
    name: body.name,
    webgpu: !!body.webgpu,
    userAgent: ua,
  });
  return NextResponse.json(res);
}

