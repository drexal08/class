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
const AUTH_ROUTES = ["/login", "/register"];

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

  if (hasSession && AUTH_ROUTES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/course/:path*",
    "/admin/:path*",
    "/todo/:path*",
    "/calendar/:path*",
    "/archived/:path*",
    "/settings/:path*",
    "/join/:path*",
    "/login",
    "/register",
  ],
};
