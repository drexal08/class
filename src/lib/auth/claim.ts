import "server-only";

import { cache } from "react";

import { prisma } from "@/lib/prisma";

export class ClaimRequiredError extends Error {
  constructor() {
    super("Confirm your identity before continuing");
    this.name = "ClaimRequiredError";
  }
}

/** The oldest active unclaimed membership is the one the welcome page resolves. */
export const getPendingClaim = cache(async (userId: string) => {
  return prisma.cohortMember.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      claimedAt: null,
      user: { archivedAt: null },
      cohort: { archivedAt: null, school: { disabledAt: null } },
    },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      claimedAt: true,
      user: {
        select: { studentCode: true, displayName: true, nameAsImported: true },
      },
      cohort: {
        select: {
          id: true,
          label: true,
          academicYear: true,
          combination: { select: { name: true } },
          school: { select: { id: true, name: true } },
        },
      },
    },
  });
});

export async function assertClaimed(userId: string): Promise<void> {
  if (await getPendingClaim(userId)) throw new ClaimRequiredError();
}
