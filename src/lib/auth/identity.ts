import "server-only";

import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

export class AccountDisabledError extends Error {}
export class IdentityConflictError extends Error {}

export const sessionUserSelect = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  role: true,
  isAdmin: true,
  platformRole: true,
  studentCode: true,
  authKind: true,
  archivedAt: true,
} as const;

export type SessionUserRecord = SessionUser & { archivedAt: Date | null };

export function toSessionUser(record: SessionUserRecord): SessionUser {
  const { archivedAt: _archivedAt, ...user } = record;
  return user;
}

function firebaseProjectId(): string | null {
  return process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || null;
}

/** Registers a verified Firebase UID without ever reassigning an existing one. */
export async function ensureAuthIdentity(input: {
  userId: string;
  providerUid: string;
  email?: string | null;
}): Promise<void> {
  const projectId = firebaseProjectId();
  if (!projectId) return;
  const key = {
    provider_projectId_providerUid: {
      provider: "firebase",
      projectId,
      providerUid: input.providerUid,
    },
  };

  const existing = await prisma.authIdentity.findUnique({
    where: key,
    select: { userId: true },
  });
  if (existing) {
    if (existing.userId !== input.userId) throw new IdentityConflictError();
    return;
  }

  try {
    await prisma.authIdentity.create({
      data: {
        userId: input.userId,
        provider: "firebase",
        projectId,
        providerUid: input.providerUid,
        email: input.email?.toLowerCase() || null,
      },
    });
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error;
    const winner = await prisma.authIdentity.findUnique({
      where: key,
      select: { userId: true },
    });
    if (!winner || winner.userId !== input.userId) throw new IdentityConflictError();
  }
}

/**
 * Resolves a Firebase UID to its canonical LMS user. This exact function is
 * used by both session-cookie lookup and ID-token exchange; changing only one
 * would create duplicate accounts for linked identities.
 */
export async function resolveCanonicalUser(
  providerUid: string,
): Promise<SessionUserRecord | null> {
  const projectId = firebaseProjectId();
  if (projectId) {
    const identity = await prisma.authIdentity.findUnique({
      where: {
        provider_projectId_providerUid: {
          provider: "firebase",
          projectId,
          providerUid,
        },
      },
      select: { user: { select: sessionUserSelect } },
    });
    if (identity?.user) {
      if (identity.user.archivedAt) throw new AccountDisabledError();
      return identity.user as SessionUserRecord;
    }
  }

  const direct = await prisma.user.findUnique({
    where: { id: providerUid },
    select: sessionUserSelect,
  });
  if (!direct) return null;
  if (direct.archivedAt) throw new AccountDisabledError();

  await ensureAuthIdentity({ userId: direct.id, providerUid, email: direct.email });
  return direct as SessionUserRecord;
}
