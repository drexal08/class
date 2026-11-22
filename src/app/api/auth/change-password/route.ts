import { NextResponse } from "next/server";
import { z } from "zod";

import { getAdminAuth } from "@/lib/firebase/admin";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { destroySession, createFirebaseSession } from "@/lib/auth/session";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const admin = await getAdminAuth();
  if (!admin) {
    return NextResponse.json(
      { error: "Firebase Admin not configured" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { currentPassword, newPassword } = parsed.data;

  // Verify current password using Firebase Identity Toolkit
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Firebase API key not configured" },
      { status: 503 },
    );
  }

  const email = user.email;
  if (!email) {
    return NextResponse.json({ error: "No email on account" }, { status: 400 });
  }

  // Verify current password
  const verifyResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: currentPassword,
        returnSecureToken: true,
      }),
    }
  );

  const verifyData = await verifyResponse.json();
  if (!verifyResponse.ok) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  }

  // Update password in Firebase for all linked identities
  // Get all auth identities for this user
  const identities = await prisma.authIdentity.findMany({
    where: { userId: user.id },
    select: { providerId: true, provider: true },
  });

  // Update password for each Firebase UID (they may be different per provider)
  // In practice, Firebase uses a single password per user record (by email)
  // But we should also update the primary Firebase user
  try {
    const firebaseUser = await admin.getUserByEmail(email);
    await admin.updateUser(firebaseUser.uid, { password: newPassword });
  } catch {
    return NextResponse.json({ error: "Failed to update password in Firebase" }, { status: 500 });
  }

  // Update passwordOverridden flag
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordOverridden: true },
  });

  // Revoke all sessions (this will force re-login on all devices)
  try {
    await admin.revokeRefreshTokens(user.id);
  } catch {
    // Ignore revocation errors
  }

  // Create new session cookie with the new password
  await createFirebaseSession(verifyData.idToken);

  // Audit event
  await prisma.auditEvent.create({
    data: {
      actorId: user.id,
      action: "PASSWORD_CHANGED",
      targetType: "User",
      targetId: user.id,
    },
  });

  return NextResponse.json({ ok: true });
}