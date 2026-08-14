import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/neighborhoods",
  "/api/health",
  "/api/stripe/webhook",
];

/**
 * Invite landing pages are public: /join/<code> is the first screen an invited
 * neighbor sees, before they have an account. PUBLIC_PATHS is exact-match only,
 * so this is the one prefix exception — and it stays anchored to the /join
 * segment (`/join` itself, or anything under `/join/`) so it can't widen to a
 * route like /joinsomething-protected.
 */
function isPublicInvitePath(pathname: string) {
  return pathname === "/join" || pathname.startsWith("/join/");
}

function isPublicGamesPath(pathname: string) {
  return pathname === "/games" || pathname.startsWith("/games/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Anchor the static-asset test to a real file extension on the LAST segment.
  // A bare `pathname.includes(".")` would let any client-controlled route param
  // containing a dot (/feed/a.b, /api/conversations/a.b/messages) skip the
  // session check entirely.
  const isStaticAsset = /\.[a-z0-9]+$/i.test(pathname.split("/").pop() ?? "");

  if (
    PUBLIC_PATHS.includes(pathname) ||
    isPublicInvitePath(pathname) ||
    isPublicGamesPath(pathname) ||
    pathname.startsWith("/_next") ||
    isStaticAsset
  ) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
