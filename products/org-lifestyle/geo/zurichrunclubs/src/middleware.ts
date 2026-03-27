import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Belt-and-suspenders: avoid stale HTML at proxies; matches next.config headers(). */
export function middleware(_request: NextRequest) {
  const res = NextResponse.next();
  res.headers.set("Cache-Control", "private, no-cache, no-store, max-age=0, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
