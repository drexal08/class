import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const courseSelect = {
  select: { id: true, name: true, accent: true },
} as const;

/**
 * Cross-class work list for a student.
 *
 * Split the way a student actually thinks about it: what is still to do, what
 * was missed, and what is finished.
 */
export async function getStudentTodo() {
  const user = await getCurrentUser();
  if (!user) return { assigned: [], missing: [], done: [] };

  const assignments = await prisma.assignment.findMany({
    where: {
      published: true,
      type: { not: "MATERIAL" },
      course: {
        archived: false,
        enrollments: { some: { userId: user.id, role: "STUDENT" } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      dueDate: true,
      maxPoints: true,
      type: true,
      course: courseSelect,
      submissions: {
        where: { studentId: user.id },
        select: { status: true, grade: true },
      },
    },
  });

  const now = Date.now();
  const items = assignments.map(({ submissions, ...assignment }) => ({
    ...assignment,
    submission: submissions[0] ?? null,
  }));

  const outstanding = items.filter(
    (item) => !item.submission || item.submission.status === "ASSIGNED",
  );

  return {
    assigned: outstanding.filter(
      (item) => !item.dueDate || new Date(item.dueDate).getTime() >= now,
    ),
    missing: outstanding.filter(
      (item) => item.dueDate && new Date(item.dueDate).getTime() < now,
    ),
    done: items.filter(
      (item) => item.submission && item.submission.status !== "ASSIGNED",
    ),
  };
}

/** Cross-class review queue for a teacher: what is waiting to be marked. */
export async function getTeacherTodo() {
  const user = await getCurrentUser();
  if (!user) return { toReview: [], graded: [] };

  const assignments = await prisma.assignment.findMany({
    where: {
      type: { not: "MATERIAL" },
      course: {
        archived: false,
        enrollments: { some: { userId: user.id, role: "TEACHER" } },
      },
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      dueDate: true,
      maxPoints: true,
      type: true,
      course: courseSelect,
      submissions: {
        select: { status: true },
      },
    },
  });

  const items = assignments.map(({ submissions, ...assignment }) => {
    const turnedIn = submissions.filter((s) =>
      ["SUBMITTED", "LATE"].includes(s.status),
    ).length;
    const graded = submissions.filter((s) =>
      ["GRADED", "RETURNED"].includes(s.status),
    ).length;

    return { ...assignment, turnedIn, graded };
  });

  return {
    toReview: items.filter((item) => item.turnedIn > 0),
    graded: items.filter((item) => item.turnedIn === 0 && item.graded > 0),
  };
}

/** Every dated item across a user's active classes, for the calendar. */
export async function getCalendarItems() {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.assignment.findMany({
    where: {
      dueDate: { not: null },
      published: true,
      course: {
        archived: false,
        enrollments: { some: { userId: user.id } },
      },
    },
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      title: true,
      dueDate: true,
      type: true,
      maxPoints: true,
      course: courseSelect,
      submissions: {
        where: { studentId: user.id },
        select: { status: true },
      },
    },
  });
}
