import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Pages that need a signed-in user. This is only a fast first gate (is there a session cookie?);
// the backend validates the session on every API call and the app layout checks the role.
const PROTECTED_PREFIXES = ["/client", "/provider", "/admin", "/booking", "/checkout", "/track"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const needsSession = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (needsSession && !request.cookies.get("sh_session")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname + search);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|js|css|woff2?)$).*)"],
};
