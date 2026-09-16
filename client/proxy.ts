import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionCookie, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  const session = raw ? await verifySessionCookie(raw) : null;

  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  // manifest.webmanifest/sw.js/icons must stay public — the browser fetches
  // these to decide installability and to run the service worker before
  // (or without) a logged-in session existing at all.
  matcher: [
    "/((?!login|api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
