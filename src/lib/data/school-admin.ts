import "server-only";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  requireCohortAccess,
  requireSchoolAdmin,
  requireSuperuser,
} from "@/lib/sdms/access";

export async function listTeacherSchools() {
  const user = await requireUser();
  return prisma.schoolMember.findMany({
    where: { userId: user.id, status: "ACTIVE", school: { disabledAt: null } },
    orderBy: { school: { name: "asc" } },
    select: {
      role: true,
      school: { select: { id: true, name: true, isLegacy: true } },
    },
  });
}

export async function listAdminSchools() {
  const user = await requireUser();
  return prisma.schoolMember.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      role: "ADMIN",
      school: { disabledAt: null },
    },
    orderBy: { school: { name: "asc" } },
    select: { school: { select: { id: true, name: true, isLegacy: true } } },
  });
}

/** Platform structure and counts only; no student rows are returned. */
export async function listPlatformSchools() {
  await requireSuperuser();
  const schools = await prisma.school.findMany({
    orderBy: [{ isLegacy: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      disabledAt: true,
      isLegacy: true,
      createdAt: true,
      joinCodes: {
        where: { kind: "SCHOOL" },
        select: { code: true },
        take: 1,
      },
      members: {
        where: { role: "ADMIN", status: "ACTIVE" },
        select: { user: { select: { displayName: true, email: true } } },
      },
      cohorts: { select: { _count: { select: { members: true } } } },
      _count: { select: { members: true, cohorts: true, courses: true } },
    },
  });
  return schools.map((school: {
    cohorts: Array<{ _count: { members: number } }>;
    [key: string]: unknown;
  }) => ({
    ...school,
    studentCount: school.cohorts.reduce(
      (total: number, cohort) => total + cohort._count.members,
      0,
    ),
  }));
}

export async function getSchoolAdminOverview(schoolId: string) {
  await requireSchoolAdmin(schoolId);
  return prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      id: true,
      name: true,
      slug: true,
      isLegacy: true,
      requiresApproval: true,
      joinCodes: { where: { kind: "SCHOOL" }, select: { code: true }, take: 1 },
      members: {
        orderBy: [{ status: "asc" }, { requestedAt: "asc" }],
        select: {
          id: true,
          role: true,
          status: true,
          requestedAt: true,
          user: {
            select: { id: true, displayName: true, email: true, avatarUrl: true },
          },
        },
      },
      cohorts: {
        where: { archivedAt: null },
        orderBy: [{ combination: { stream: "asc" } }, { label: "asc" }],
        select: {
          id: true,
          label: true,
          grade: true,
          academicYear: true,
          combination: { select: { name: true, shortName: true, stream: true } },
          _count: { select: { members: true, courses: true } },
        },
      },
    },
  });
}

export async function getCohortRoster(cohortId: string) {
  await requireCohortAccess(cohortId);
  return prisma.cohort.findUnique({
    where: { id: cohortId },
    select: {
      id: true,
      schoolId: true,
      label: true,
      grade: true,
      academicYear: true,
      combination: { select: { name: true, stream: true } },
      school: { select: { name: true } },
      joinCodes: { where: { kind: "COHORT" }, select: { code: true }, take: 1 },
      members: {
        orderBy: { user: { displayName: "asc" } },
        select: {
          id: true,
          status: true,
          claimedAt: true,
          lastSignInAt: true,
          user: {
            select: { studentCode: true, displayName: true, gender: true },
          },
          disputes: { where: { resolvedAt: null }, select: { id: true }, take: 1 },
        },
      },
      courses: {
        select: { id: true, name: true, subject: true, kind: true },
        orderBy: { name: "asc" },
      },
    },
  });
}

function csvCell(value: unknown): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export async function exportClaimStatusCsv(cohortId: string): Promise<string> {
  const cohort = await prisma.cohort.findUnique({
    where: { id: cohortId },
    select: { schoolId: true },
  });
  if (!cohort) throw new Error("Cohort not found");
  await requireSchoolAdmin(cohort.schoolId);
  const roster = await getCohortRoster(cohortId);
  const rows = roster?.members ?? [];
  const lines = ["code,name,gender,claimed_at,last_sign_in,claim_status,membership_status"];
  for (const member of rows) {
    const claimState = member.disputes.length > 0
      ? "DISPUTED"
      : member.claimedAt
        ? "CLAIMED"
        : "UNCLAIMED";
    lines.push([
      csvCell(member.user.studentCode),
      csvCell(member.user.displayName),
      csvCell(member.user.gender),
      csvCell(member.claimedAt?.toISOString()),
      csvCell(member.lastSignInAt?.toISOString()),
      csvCell(claimState),
      csvCell(member.status),
    ].join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}
