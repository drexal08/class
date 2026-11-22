import "server-only";

import { AuthError, requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/types";

export async function requireSuperuser(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.platformRole !== "SUPERUSER") {
    throw new AuthError("Only platform superusers can do that");
  }
  return user;
}

export async function requireSchoolMember(
  schoolId: string,
  options: { admin?: boolean } = {},
) {
  const user = await requireUser();
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      isLegacy: true,
      disabledAt: true,
      members: {
        where: { userId: user.id, status: "ACTIVE" },
        select: { id: true, role: true, status: true },
      },
    },
  });
  if (!school || school.disabledAt) throw new AuthError("That school is unavailable");
  const membership = school.members[0];
  if (!membership) throw new AuthError("You are not an active member of this school");
  if (options.admin && membership.role !== "ADMIN") {
    throw new AuthError("Only a school admin can do that");
  }
  return { user, school, membership };
}

export async function requireSchoolAdmin(schoolId: string) {
  return requireSchoolMember(schoolId, { admin: true });
}

export async function getSchoolMember(schoolId: string, userId: string) {
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      isLegacy: true,
      disabledAt: true,
      members: {
        where: { userId, status: "ACTIVE" },
        select: { id: true, role: true, status: true },
      },
    },
  });
  if (!school || school.disabledAt) return null;
  return school.members[0] ?? null;
}

export async function requireCohortAccess(cohortId: string) {
  return resolveCohortAccess(cohortId, "read");
}

export async function requireCohortOwner(cohortId: string) {
  return resolveCohortAccess(cohortId, "owner");
}

export async function requireCohortManager(cohortId: string) {
  return resolveCohortAccess(cohortId, "manager");
}

async function resolveCohortAccess(
  cohortId: string,
  level: "read" | "owner" | "manager",
) {
  const user = await requireUser();
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      schoolId: true,
      ownerId: true,
      label: true,
      archivedAt: true,
      school: {
        select: {
          disabledAt: true,
          members: {
            where: { userId: user.id, status: "ACTIVE" },
            select: { role: true },
          },
        },
      },
      courses: {
        where: { teacherId: user.id },
        select: { id: true },
        take: 1,
      },
    },
  });
  if (!cohort || cohort.archivedAt || cohort.school.disabledAt) {
    throw new AuthError("That cohort is unavailable");
  }
  const membership = cohort.school.members[0];
  if (!membership) throw new AuthError("You are not an active member of this school");

  const isAdmin = membership.role === "ADMIN";
  const isOwner = cohort.ownerId === user.id;
  if (level === "owner" && !isAdmin && !isOwner) {
    throw new AuthError("Only the cohort owner or a school admin can do that");
  }
  if (level === "manager" && !isAdmin && !isOwner && cohort.courses.length === 0) {
    throw new AuthError("Only a teacher of this cohort can do that");
  }
  return { user, cohort, membership };
}

export async function requireActiveCohortMember(cohortId: string) {
  const user = await requireUser();
  const membership = await prisma.cohortMember.findFirst({
    where: {
      cohortId,
      userId: user.id,
      status: "ACTIVE",
      cohort: { archivedAt: null, school: { disabledAt: null } },
    },
    select: { id: true, status: true, cohortId: true },
  });
  if (!membership) throw new AuthError("You are not an active member of this cohort");
  return { user, membership };
}
