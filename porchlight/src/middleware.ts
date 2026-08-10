import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/api/auth/login", "/api/auth/signup", "/api/neighborhoods"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Anchor the static-asset test to a real file extension on the LAST segment.
  // A bare `pathname.includes(".")` would let any client-controlled route param
  // containing a dot (/feed/a.b, /api/conversations/a.b/messages) skip the
  // session check entirely.
  const isStaticAsset = /\.[a-z0-9]+$/i.test(pathname.split("/").pop() ?? "");

  if (
    PUBLIC_PATHS.includes(pathname) ||
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
