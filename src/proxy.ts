import { NextResponse, type NextRequest } from "next/server";

/**
 * Route gate.
 *
 * Next 16 renamed `middleware.ts` to `proxy.ts`; the exported function must be
 * named `proxy`.
 *
 * This checks only that a session cookie is *present*. It deliberately does not
 * verify it: the Firebase Admin SDK cannot run here, and doing a cryptographic
 * verification on every navigation would add a round-trip per request. The
 * cookie's presence is a cheap UX gate that keeps signed-out users off app
 * pages — authorization itself is decided in server components and actions,
 * where `getCurrentUser()` verifies the cookie for real. A forged cookie gets
 * past this file and is rejected there.
 */
const SESSION_COOKIE = "__session";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/course",
  "/admin",
  "/todo",
  "/calendar",
  "/archived",
  "/settings",
  "/join",
];

/**
 * The signed-out landing page.
 *
 * Signed-in visitors are sent to their dashboard from here rather than from
 * the page itself. The page used to look up the visitor in the database to
 * decide, which meant every anonymous request waited on a live query against a
 * database that scales to zero. The cookie check below is free, so the landing
 * page stays a static document served from the CDN.
 *
 * A cookie that turns out to be expired or revoked cannot be spotted from
 * here, so the visitor is handed to `/api/auth/landing`, which verifies it for
 * real and either continues to the dashboard or clears it and puts the visitor
 * back on the landing page. Anonymous visitors never go there at all.
 */
const LANDING_ROUTE = "/";
const LANDING_CHECK_ROUTE = "/api/auth/landing";

/**
 * Set for a few seconds after `/api/auth/landing` has looked at a session
 * cookie and could not clear it.
 *
 * Without it, a visitor whose cookie is fine but whose database is down would
 * be sent round the same loop for as long as the cookie lives.
 */
const LANDING_CHECKED_COOKIE = "__landing_checked";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    // Preserve where they were heading so sign-in can return them there.
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname === LANDING_ROUTE) {
    const justChecked = Boolean(
      request.cookies.get(LANDING_CHECKED_COOKIE)?.value,
    );
    if (!justChecked) {
      const url = new URL(LANDING_CHECK_ROUTE, request.url);
      url.searchParams.set("next", `${pathname}${search}`);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/dashboard/:path*",
    "/course/:path*",
    "/admin/:path*",
    "/todo/:path*",
    "/calendar/:path*",
    "/archived/:path*",
    "/settings/:path*",
    "/join/:path*",
  ],
};
