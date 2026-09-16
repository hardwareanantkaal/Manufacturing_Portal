import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? await verifySessionCookie(raw) : null;

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
