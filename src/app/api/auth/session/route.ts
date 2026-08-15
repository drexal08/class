import { NextResponse } from "next/server";

import {
  createDevSession,
  createFirebaseSession,
  destroySession,
} from "@/lib/auth/session";
import {
  isDevAuthEnabled,
  isFirebaseAdminConfigured,
} from "@/lib/env";
import { getAdminAuth } from "@/lib/firebase/admin";
import { prisma } from "@/lib/prisma";
import { sessionSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Exchanges a Firebase ID token for a session cookie and syncs the user into
 * PostgreSQL (PRD Module A).
 *
 * When Firebase is not configured and AUTH_DEV_MODE is on, accepts an email
 * instead so the app is usable locally without a Firebase project.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = sessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { idToken, intendedRole, devEmail, devName } = parsed.data;

  try {
    if (idToken && isFirebaseAdminConfigured()) {
      return await signInWithFirebase(idToken, intendedRole);
    }

    if (devEmail && isDevAuthEnabled()) {
      return await signInForDevelopment(devEmail, devName, intendedRole);
    }

    return NextResponse.json(
      {
        error: isFirebaseAdminConfigured()
          ? "An ID token is required"
          : "Authentication is not configured on this server. See SETUP.md.",
      },
      { status: 400 },
    );
  } catch (error) {
    console.error("[auth] Sign-in failed", error);
    return NextResponse.json(
      { error: "Could not sign you in. Please try again." },
      { status: 401 },
    );
  }
}

export async function DELETE() {
  await destroySession();
  return NextResponse.json({ ok: true });
}

async function signInWithFirebase(idToken: string, intendedRole?: "TEACHER" | "STUDENT") {
  const auth = await getAdminAuth();
  if (!auth) {
    return NextResponse.json(
      { error: "Firebase Admin is not configured" },
      { status: 500 },
    );
  }

  const decoded = await auth.verifyIdToken(idToken, true);

  // Firebase's documented guard: only mint a session cookie from a token issued
  // in the last few minutes, so a leaked long-lived ID token is not enough.
  const authTimeMs = (decoded.auth_time ?? 0) * 1000;
  if (Date.now() - authTimeMs > 5 * 60 * 1000) {
    return NextResponse.json(
      { error: "Please sign in again" },
      { status: 401 },
    );
  }

  const user = await upsertUser({
    id: decoded.uid,
    email: decoded.email ?? "",
    displayName: (decoded.name as string | undefined) ?? null,
    avatarUrl: (decoded.picture as string | undefined) ?? null,
    intendedRole,
  });

  await createFirebaseSession(idToken);
  return NextResponse.json({ ok: true, role: user.role });
}

async function signInForDevelopment(
  email: string,
  displayName?: string,
  intendedRole?: "TEACHER" | "STUDENT",
) {
  // A stable synthetic uid so repeated dev sign-ins map to the same row.
  const id = `dev_${Buffer.from(email).toString("hex").slice(0, 40)}`;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { displayName: displayName ?? undefined },
        select: { id: true, role: true },
      })
    : await upsertUser({
        id,
        email,
        displayName: displayName ?? email.split("@")[0],
        avatarUrl: null,
        intendedRole,
      });

  await createDevSession(user.id);
  return NextResponse.json({ ok: true, role: user.role, dev: true });
}

/**
 * `role` is set only when the account is created. Honouring it on update would
 * let any signed-in user POST themselves to TEACHER.
 */
async function upsertUser(input: {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  intendedRole?: "TEACHER" | "STUDENT";
}) {
  return prisma.user.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      email: input.email,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl,
      role: input.intendedRole ?? "STUDENT",
    },
    update: {
      email: input.email,
      displayName: input.displayName ?? undefined,
      avatarUrl: input.avatarUrl ?? undefined,
    },
    select: { id: true, role: true },
  });
}
