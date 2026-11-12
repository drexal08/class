import "server-only";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { BridgeLevel } from "@/generated/prisma/client";

/**
 * Loads everything the native CLA Bridge page needs for one request.
 *
 * A student is always resolved to the level saved in their profile, even if a
 * different `?level=` is supplied. Admins may inspect any level.
 */
export async function getBridgeWorkspace(requestedLevel?: BridgeLevel) {
  const user = await requireUser();

  if (user.role === "TEACHER") {
    return { allowed: false as const, user };
  }

  const profile = await prisma.bridgeProfile.findUnique({
    where: { userId: user.id },
  });

  const level =
    user.role === "ADMIN" && requestedLevel
      ? requestedLevel
      : (profile?.level ?? null);

  const estimate = level
    ? await prisma.bridgeEstimate.findUnique({
        where: { userId_level: { userId: user.id, level } },
      })
    : null;

  return { allowed: true as const, user, profile, level, estimate };
}
