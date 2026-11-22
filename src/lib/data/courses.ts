import "server-only";

import { cache } from "react";

import { requireAdmin, requireCourseAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resolveCourseAccess } from "@/lib/rules";

/**
 * Reads live here rather than in a `"use server"` file.
 *
 * Every export of a `"use server"` module becomes a public POST endpoint; these
 * functions are only ever reachable through a server render, so enrollment
 * checks cannot be bypassed by calling them directly.
 */

export type CourseSummary = Awaited<
  ReturnType<typeof listUserCourses>
>[number];

export async function listUserCourses(): Promise<
  Array<{
    id: string;
    name: string;
    section: string | null;
    subject: string | null;
    room: string | null;
    code: string;
    accent: string;
    archived: boolean;
    teacher: { id: string; displayName: string | null; email: string };
    _count: { enrollments: number; assignments: number };
    enrollmentRole: import("@/generated/prisma/client").$Enums.Role;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: user.id,
      active: true,
      course: {
        archived: false,
        OR: [{ schoolId: null }, { school: { disabledAt: null } }],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      role: true,
      course: {
        select: {
          id: true,
          name: true,
          section: true,
          subject: true,
          room: true,
          code: true,
          accent: true,
          archived: true,
          teacher: { select: { id: true, displayName: true, email: true } },
          _count: { select: { enrollments: true, assignments: true } },
        },
      },
    },
  });

  return enrollments.map((enrollment: {
    course: {
      id: string;
      name: string;
      section: string | null;
      subject: string | null;
      room: string | null;
      code: string;
      accent: string;
      archived: boolean;
      teacher: { id: string; displayName: string | null; email: string };
      _count: { enrollments: number; assignments: number };
    };
    role: import("@/generated/prisma/client").$Enums.Role;
  }) => ({
    ...enrollment.course,
    enrollmentRole: enrollment.role,
  }));
}

export async function listArchivedCourses(): Promise<
  Array<{
    id: string;
    name: string;
    section: string | null;
    subject: string | null;
    code: string;
    accent: string;
    archived: boolean;
    teacher: { id: string; displayName: string | null; email: string };
    enrollmentRole: import("@/generated/prisma/client").$Enums.Role;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: {
      userId: user.id,
      active: true,
      course: {
        archived: true,
        OR: [{ schoolId: null }, { school: { disabledAt: null } }],
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      role: true,
      course: {
        select: {
          id: true,
          name: true,
          section: true,
          subject: true,
          code: true,
          accent: true,
          archived: true,
          teacher: { select: { id: true, displayName: true, email: true } },
        },
      },
    },
  });

  return enrollments.map((enrollment: {
    course: {
      id: string;
      name: string;
      section: string | null;
      subject: string | null;
      code: string;
      accent: string;
      archived: boolean;
      teacher: { id: string; displayName: string | null; email: string };
    };
    role: import("@/generated/prisma/client").$Enums.Role;
  }) => ({
    ...enrollment.course,
    enrollmentRole: enrollment.role,
  }));
}

/**
 * The course plus the caller's role in it. Returns `null` when the user is not
 * a member, so pages can render a 404 instead of leaking that it exists.
 */
export const getCourseForUser = cache(async (courseId: string) => {
  const user = await getCurrentUser();
  if (!user) return null;

  const course = await prisma.course.findUnique({
    where: { id: courseId },
    select: {
      id: true,
      name: true,
      section: true,
      subject: true,
      room: true,
      code: true,
      accent: true,
      archived: true,
      createdAt: true,
      teacherId: true,
      description: true,
      postPolicy: true,
      cohortId: true,
      schoolId: true,
      school: {
        select: {
          disabledAt: true,
          members: {
            where: { userId: user.id, status: "ACTIVE" },
            select: { role: true },
          },
        },
      },
      teacher: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
      enrollments: {
        where: { userId: user.id },
        select: { role: true, active: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course || course.school?.disabledAt) return null;

  const enrollment = course.enrollments[0] ?? null;
  const schoolAdmin = course.school?.members[0]?.role === "ADMIN";
  if (enrollment && !enrollment.active && !schoolAdmin) return null;
  const resolved = resolveCourseAccess({ isAdmin: user.isAdmin, enrollment });
  const access = resolved ?? (schoolAdmin
    ? { role: "TEACHER" as const, isTeacher: true, canManage: true, isEnrolled: false }
    : null);
  if (!access) return null;

  const { enrollments, ...rest } = course;
  return {
    ...rest,
    viewerRole: access.role,
    isTeacher: access.isTeacher,
    canManage: access.canManage,
    isEnrolled: access.isEnrolled,
  };
});

/** Looks up a class from an invite code, for the join confirmation screen. */
export async function getCourseByCode(code: string) {
  const user = await getCurrentUser();
  if (!user) return null;

  const course = await prisma.course.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: {
      id: true,
      name: true,
      section: true,
      subject: true,
      accent: true,
      archived: true,
      school: { select: { disabledAt: true } },
      teacher: { select: { displayName: true, email: true, avatarUrl: true } },
      _count: { select: { enrollments: true } },
      enrollments: {
        where: { userId: user.id, active: true },
        select: { id: true },
      },
    },
  });
  if (!course || course.school?.disabledAt) return null;

  const { enrollments, ...rest } = course;
  return { ...rest, alreadyEnrolled: enrollments.length > 0 };
}

export async function listCourseMembers(
  courseId: string,
): Promise<
  Array<{
    id: string;
    role: import("@/generated/prisma/client").$Enums.Role;
    muted: boolean;
    createdAt: Date;
    user: {
      id: string;
      displayName: string | null;
      email: string | null;
      avatarUrl: string | null;
    };
  }>
> {
  const context = await requireCourseAccess(courseId);

  const members = await prisma.enrollment.findMany({
    where: { courseId, active: true },
    orderBy: [{ role: "asc" }, { user: { displayName: "asc" } }],
    select: {
      id: true,
      role: true,
      muted: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  // Students see classmates but not their email addresses; teachers manage the
  // roster and need them.
  return members.map((member: {
    id: string;
    role: import("@/generated/prisma/client").$Enums.Role;
    muted: boolean;
    createdAt: Date;
    user: { id: string; displayName: string | null; email: string | null; avatarUrl: string | null };
  }) => ({
    ...member,
    user: {
      ...member.user,
      email: context.isTeacher ? member.user.email : null,
    },
  }));
}

/** Directory listing for the admin console. Administrators only. */
export async function listAllUsers(query?: string) {
  await requireAdmin();

  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: "insensitive" } },
            { displayName: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      email: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      isAdmin: true,
      createdAt: true,
      _count: { select: { enrollments: true, createdCourses: true } },
    },
  });
}

export async function getInstitutionStats() {
  await requireAdmin();

  const [users, courses, assignments, submissions] = await Promise.all([
    prisma.user.count(),
    prisma.course.count({ where: { archived: false } }),
    prisma.assignment.count(),
    prisma.submission.count({ where: { status: { in: ["GRADED", "RETURNED"] } } }),
  ]);

  return { users, courses, assignments, graded: submissions };
}
