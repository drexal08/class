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
import { accountRoleDecision } from "@/lib/rules";
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

async function signInWithFirebase(
  idToken: string,
  intendedRole?: "TEACHER" | "STUDENT",
) {
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

  const email = decoded.email ?? "";
  const displayName = (decoded.name as string | undefined) ?? null;
  const avatarUrl = (decoded.picture as string | undefined) ?? null;

  const existing = await prisma.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, role: true },
  });

  const decision = accountRoleDecision({
    existingRole: existing?.role ?? null,
    intendedRole,
  });

  // A brand-new account has to say what it is before it is created. Creating
  // it silently as a student put every Google sign-up into the student
  // experience — a teacher who clicked "Continue with Google" ended up with
  // no way to create a class and no way to change their role.
  if (decision.kind === "ask") {
    return askForRole(email || null, displayName);
  }

  if (decision.kind === "create") {
    const created = await prisma.user.create({
      data: {
        id: decoded.uid,
        email,
        displayName,
        avatarUrl,
        role: decision.role,
      },
      select: { id: true, role: true },
    });

    await createFirebaseSession(idToken);
    return NextResponse.json({ ok: true, role: created.role });
  }

  // An account that already exists keeps the role it was given. Honouring a
  // role on update would let any signed-in user promote themselves.
  const updated = await prisma.user.update({
    where: { id: existing!.id },
    data: {
      email,
      displayName: displayName ?? undefined,
      avatarUrl: avatarUrl ?? undefined,
    },
    select: { id: true, role: true },
  });

  await createFirebaseSession(idToken);
  return NextResponse.json({ ok: true, role: updated.role });
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

  const decision = accountRoleDecision({
    existingRole: existing?.role ?? null,
    intendedRole,
  });

  if (decision.kind === "ask") {
    return askForRole(email, displayName ?? null);
  }

  if (decision.kind === "create") {
    const created = await prisma.user.create({
      data: {
        id,
        email,
        displayName: displayName ?? email.split("@")[0],
        avatarUrl: null,
        role: decision.role,
      },
      select: { id: true, role: true },
    });

    await createDevSession(created.id);
    return NextResponse.json({ ok: true, role: created.role, dev: true });
  }

  const updated = await prisma.user.update({
    where: { id: existing!.id },
    data: { displayName: displayName ?? undefined },
    select: { id: true, role: true },
  });

  await createDevSession(updated.id);
  return NextResponse.json({ ok: true, role: updated.role, dev: true });
}

/**
 * Tells the browser that the account is new and needs to be told what it is.
 *
 * No user row is created and no session is minted: the account only comes into
 * existence once the person answers, so there is never a half-created student
 * to fix up by hand.
 */
function askForRole(email: string | null, displayName: string | null) {
  return NextResponse.json(
    { needsRole: true, email, displayName },
    { status: 409 },
  );
}
