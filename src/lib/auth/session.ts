import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { cache } from "react";

import { getAdminAuth } from "@/lib/firebase/admin";
import { isDevAuthEnabled, isFirebaseAdminConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

/**
 * `__session` is the only cookie Firebase Hosting forwards to an origin, so
 * using that name keeps the door open for that deployment target.
 */
export const SESSION_COOKIE = "__session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_MAX_AGE_SECONDS,
};

/**
 * Resolves the signed-in user for the current request.
 *
 * Wrapped in `React.cache`, so the layout, the page, the header and every data
 * function share a single cookie verification and a single database read per
 * request instead of repeating both four or five times.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const result = await lookupSession();
  return result.status === "signed-in" ? result.user : null;
});

/**
 * The same lookup, but it says *why* there is no user.
 *
 * "Not signed in" and "the database is down" have to be told apart: a route
 * that clears an unusable session cookie must not mistake a database outage
 * for an expired session and sign the person out.
 */
export const lookupSession = cache(async (): Promise<SessionLookup> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return { status: "signed-out" };

  const uid = await resolveUid(token);
  if (uid.status !== "ok") return uid;

  try {
    const user = await prisma.user.findUnique({
      where: { id: uid.uid },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isAdmin: true,
      },
    });
    if (!user) return { status: "invalid" };
    return { status: "signed-in", user };
  } catch (error) {
    // A missing or unreachable database must read as "signed out", never a 500.
    console.error("[auth] Could not load the current user", error);
    return { status: "unavailable" };
  }
});

export type SessionLookup =
  | { status: "signed-out" }
  | { status: "signed-in"; user: SessionUser }
  | { status: "invalid" }
  | { status: "unavailable" };

/**
 * The Firebase errors that mean the cookie itself is no good.
 *
 * Anything else — a network failure, a configuration problem — is a fault on
 * this side of the connection, and treating it as a rejected session would
 * sign people out because of a bad afternoon at Google's end.
 */
const REJECTED_SESSION_CODES = new Set([
  "auth/session-cookie-revoked",
  "auth/id-token-expired",
  "auth/invalid-session-cookie",
  "auth/user-disabled",
  "auth/invalid-credential",
  "auth/argument-error",
]);

async function resolveUid(
  token: string,
): Promise<
  { status: "ok"; uid: string } | { status: "invalid" } | { status: "unavailable" }
> {
  if (isFirebaseAdminConfigured()) {
    const auth = await getAdminAuth();
    if (!auth) return { status: "unavailable" };
    try {
      // `true` checks the token against revoked sessions — this is what makes
      // sign-out on one device take effect on the others.
      const decoded = await auth.verifySessionCookie(token, true);
      return { status: "ok", uid: decoded.uid };
    } catch (error) {
      const code =
        typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code)
          : "";
      if (REJECTED_SESSION_CODES.has(code)) return { status: "invalid" };
      console.error("[auth] Could not verify the session cookie", error);
      return { status: "unavailable" };
    }
  }

  if (isDevAuthEnabled()) {
    const uid = verifyDevToken(token);
    return uid ? { status: "ok", uid } : { status: "invalid" };
  }

  return { status: "invalid" };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

/** Mints a Firebase session cookie from a freshly issued ID token. */
export async function createFirebaseSession(idToken: string): Promise<void> {
  const auth = await getAdminAuth();
  if (!auth) throw new Error("Firebase Admin is not configured");

  const sessionCookie = await auth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });

  (await cookies()).set(SESSION_COOKIE, sessionCookie, COOKIE_OPTIONS);
}

export async function createDevSession(userId: string): Promise<void> {
  if (!isDevAuthEnabled()) {
    throw new Error("Development sign-in is disabled");
  }
  (await cookies()).set(SESSION_COOKIE, signDevToken(userId), COOKIE_OPTIONS);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (token && isFirebaseAdminConfigured()) {
    try {
      const auth = await getAdminAuth();
      const decoded = await auth?.verifySessionCookie(token, false);
      // Revoking invalidates the session everywhere, not just in this browser.
      if (decoded) await auth?.revokeRefreshTokens(decoded.uid);
    } catch {
      // Already invalid — clearing the cookie is still the right outcome.
    }
  }

  store.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------------
// Development tokens
//
// Used only when AUTH_DEV_MODE=true, which `isDevAuthEnabled()` forces off in
// production. Format: base64url(payload).hmac
// ---------------------------------------------------------------------------

function devSecret(): string {
  return (
    process.env.DEV_SESSION_SECRET ||
    "lms-core-insecure-development-secret-do-not-use-in-production"
  );
}

function signDevToken(userId: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid: userId,
      exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    }),
  ).toString("base64url");

  return `${payload}.${hmac(payload)}`;
}

function verifyDevToken(token: string): string | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = hmac(payload);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);

  // Constant-time comparison; length must match first or timingSafeEqual throws.
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.uid !== "string" || typeof data.exp !== "number") return null;
    if (data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

function hmac(value: string): string {
  return createHmac("sha256", devSecret()).update(value).digest("hex");
}
