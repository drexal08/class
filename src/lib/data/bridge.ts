import "server-only";

import { requireAdmin, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { BridgeLevel } from "@/generated/prisma/client";

/**
 * Loads everything the native CLA Bridge page needs for one request.
 *
 * A student is always resolved to the level saved in their profile, even if a
 * different `?level=` is supplied. Teachers are refused the tool; admins may
 * inspect any level, whichever role they hold in the LMS.
 */
export async function getBridgeWorkspace(requestedLevel?: BridgeLevel) {
  const user = await requireUser();

  if (user.role === "TEACHER" && !user.isAdmin) {
    return { allowed: false as const, user };
  }

  const profile = await prisma.bridgeProfile.findUnique({
    where: { userId: user.id },
  });

  const level =
    user.isAdmin && requestedLevel
      ? requestedLevel
      : (profile?.level ?? null);

  const estimate = level
    ? await prisma.bridgeEstimate.findUnique({
        where: { userId_level: { userId: user.id, level } },
      })
    : null;

  return { allowed: true as const, user, profile, level, estimate };
}

/**
 * The staged clabridge students nobody has claimed yet.
 *
 * A row stays staged until the student signs up with the same address and
 * opens the estimator. `hasAccount` tells an administrator whether the
 * address already belongs to an LMS account: if it does, the row claims itself
 * the next time that student opens the estimator; if it does not, the student
 * has not registered yet and the address may be wrong.
 */
export async function listStagedBridgeStudents() {
  await requireAdmin();

  const [rows, accounts] = await Promise.all([
    prisma.bridgeLegacyStudent.findMany({
      where: { claimedAt: null },
      orderBy: [{ email: "asc" }, { username: "asc" }],
      select: {
        id: true,
        email: true,
        displayName: true,
        level: true,
        username: true,
        createdAt: true,
      },
    }),
    prisma.user.findMany({ select: { email: true } }),
  ]);

  const known = new Set(accounts.map((account) => account.email.toLowerCase()));

  return rows.map((row) => ({
    ...row,
    hasAccount: row.email ? known.has(row.email.toLowerCase()) : false,
  }));
}
