import { NextResponse, type NextRequest } from "next/server";

import {
  destroySession,
  lookupSession,
  SESSION_COOKIE,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Set for a few seconds after this route has looked at a session cookie.
 *
 * The proxy sends every visitor carrying a `__session` cookie here, because it
 * cannot tell a real session from an expired one. When the cookie turns out
 * to be unusable and cannot be cleared — because the database or Firebase is
 * unreachable — the marker stops the proxy from sending the same visitor round
 * the loop again.
 */
const CHECKED_COOKIE = "__landing_checked";
const CHECKED_MAX_AGE = 10;

/**
 * Decides where a visitor with a session cookie belongs.
 *
 * A real session goes on to the dashboard. An expired or revoked one is
 * cleared, so the visitor is put back on the landing page instead of being
 * bounced between the landing page and the sign-in page for as long as the
 * dead cookie lives in their browser.
 *
 * Anonymous visitors never reach this route. The landing page itself is
 * static and makes no database call.
 */
export async function GET(request: NextRequest) {
  const session = await lookupSession();

  if (session.status === "signed-in") {
    const response = NextResponse.redirect(new URL("/dashboard", request.url));
    response.cookies.delete(CHECKED_COOKIE);
    return response;
  }

  const response = NextResponse.redirect(
    new URL(safeTarget(request.nextUrl.searchParams.get("next")), request.url),
  );

  if (session.status === "invalid") {
    // The cookie cannot be turned into a user, so it is dead weight. Drop it
    // and let the visitor land back where they started.
    await destroySession();
    response.cookies.delete(SESSION_COOKIE);
  } else {
    // The cookie may still be good: the database or Firebase was unreachable.
    // Leave it alone and stop the proxy from asking again straight away.
    response.cookies.set(CHECKED_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: CHECKED_MAX_AGE,
    });
  }

  return response;
}

/** Only same-site paths are followed back to. */
function safeTarget(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}
