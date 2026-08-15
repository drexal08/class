import "server-only";

import { cache } from "react";

import { requireAdmin, requireCourseAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

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

export async function listUserCourses() {
  const user = await getCurrentUser();
  if (!user) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, course: { archived: false } },
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

  return enrollments.map((enrollment) => ({
    ...enrollment.course,
    enrollmentRole: enrollment.role,
  }));
}

export async function listArchivedCourses() {
  const user = await getCurrentUser();
  if (!user) return [];

  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id, course: { archived: true } },
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

  return enrollments.map((enrollment) => ({
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
      teacher: {
        select: { id: true, displayName: true, email: true, avatarUrl: true },
      },
      _count: { select: { enrollments: true } },
    },
  });
  if (!course) return null;

  if (user.role === "ADMIN") {
    return { ...course, viewerRole: "TEACHER" as const, isTeacher: true };
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: user.id, courseId } },
    select: { role: true },
  });
  if (!enrollment) return null;

  return {
    ...course,
    viewerRole: enrollment.role,
    isTeacher: enrollment.role === "TEACHER",
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
      teacher: { select: { displayName: true, email: true, avatarUrl: true } },
      _count: { select: { enrollments: true } },
      enrollments: {
        where: { userId: user.id },
        select: { id: true },
      },
    },
  });
  if (!course) return null;

  const { enrollments, ...rest } = course;
  return { ...rest, alreadyEnrolled: enrollments.length > 0 };
}

export async function listCourseMembers(courseId: string) {
  const context = await requireCourseAccess(courseId);

  const members = await prisma.enrollment.findMany({
    where: { courseId },
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
  return members.map((member) => ({
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
