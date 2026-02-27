import { NextRequest, NextResponse } from "next/server";
import { getAllOrders, setOrderStatus, type Order } from "@/lib/db";

function isAuthorized(req: NextRequest): boolean {
  const token = process.env.STORYBOOK_ADMIN_TOKEN;
  if (!token) return true;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(getAllOrders());
}

export async function PATCH(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { orderId: string; status: Order["status"] };
  const { orderId, status } = body;

  if (!orderId || !status) {
    return NextResponse.json({ error: "orderId and status required" }, { status: 400 });
  }

  const validStatuses: Order["status"][] = ["pending", "paid", "fulfilled"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  setOrderStatus(orderId, status);
  return NextResponse.json({ success: true });
}
