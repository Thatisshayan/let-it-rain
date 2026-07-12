import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE, getSessionSecretKey } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login"];

/**
 * This only checks the JWT signature/expiry as a fast-path redirect for
 * obviously-missing/invalid cookies — it does NOT re-check current
 * permissions or account-active status against the DB (Edge middleware
 * can't use the Node-only `pg` driver `@/lib/prisma` depends on, and doing
 * a DB round-trip on every request here would be wasteful anyway). The
 * authoritative check is `getSession()` (`src/lib/auth.ts`), called by
 * `(app)/layout.tsx` and every Server Action/API route, which re-resolves
 * permissions/active status from the DB on every call. A user who fails
 * that check gets redirected/401'd there, even if they pass this fast path.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/v1")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  try {
    await jwtVerify(token, getSessionSecretKey());
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/login", request.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
