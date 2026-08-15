import "server-only";

import { requireCourseAccess, requireCourseTeacher } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { SubmissionState } from "@/generated/prisma/client";

const studentSelect = {
  select: { id: true, displayName: true, email: true, avatarUrl: true },
} as const;

export type GradingRow = NonNullable<
  Awaited<ReturnType<typeof listSubmissionsForGrading>>
>["rows"][number];

/**
 * Every student on the roster, paired with their submission if one exists.
 *
 * Building the list from enrollments rather than from submissions is what makes
 * students who never opened the assignment visible — previously they were
 * simply absent from the teacher's list, which quietly hid missing work.
 */
export async function listSubmissionsForGrading(
  courseId: string,
  assignmentId: string,
) {
  await requireCourseTeacher(courseId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId },
    select: {
      id: true,
      title: true,
      maxPoints: true,
      dueDate: true,
      type: true,
      description: true,
      rubric: {
        orderBy: { sortOrder: "asc" },
        select: { id: true, title: true, description: true, points: true },
      },
    },
  });
  if (!assignment) return null;

  const [roster, submissions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      orderBy: { user: { displayName: "asc" } },
      select: { user: studentSelect },
    }),
    prisma.submission.findMany({
      where: { assignmentId, assignment: { courseId } },
      select: {
        id: true,
        studentId: true,
        status: true,
        grade: true,
        feedback: true,
        content: true,
        fileUrl: true,
        submittedAt: true,
        gradedAt: true,
        returnedAt: true,
        attachments: {
          select: { id: true, name: true, url: true, mimeType: true, size: true },
        },
        rubricScores: { select: { criterionId: true, points: true } },
        // Private teacher↔student feedback, shown beside the grade box.
        comments: {
          where: { isPrivate: true },
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            content: true,
            createdAt: true,
            authorId: true,
            author: {
              select: {
                id: true,
                displayName: true,
                email: true,
                avatarUrl: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const byStudent = new Map(submissions.map((s) => [s.studentId, s]));

  const rows = roster.map(({ user }) => {
    const submission = byStudent.get(user.id) ?? null;
    return {
      student: user,
      submission,
      status: (submission?.status ?? "ASSIGNED") as SubmissionState,
    };
  });

  return {
    assignment,
    rows,
    counts: {
      turnedIn: rows.filter((r) =>
        ["SUBMITTED", "LATE", "GRADED", "RETURNED"].includes(r.status),
      ).length,
      graded: rows.filter((r) => ["GRADED", "RETURNED"].includes(r.status)).length,
      total: rows.length,
    },
  };
}

/**
 * Gradebook for one course.
 *
 * Scoped by `assignment: { courseId }` — the original query selected every
 * submission row in the database with no filter at all, shipping every grade in
 * the system to any teacher who opened this page.
 */
export async function getGradebook(courseId: string) {
  await requireCourseTeacher(courseId);

  const [students, assignments, submissions] = await Promise.all([
    prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      orderBy: { user: { displayName: "asc" } },
      select: { user: studentSelect },
    }),
    prisma.assignment.findMany({
      where: { courseId, type: { not: "MATERIAL" }, published: true },
      orderBy: { createdAt: "asc" },
      select: { id: true, title: true, maxPoints: true, dueDate: true },
    }),
    prisma.submission.findMany({
      where: { assignment: { courseId, type: { not: "MATERIAL" } } },
      select: {
        assignmentId: true,
        studentId: true,
        grade: true,
        status: true,
      },
    }),
  ]);

  return {
    students: students.map((entry) => entry.user),
    assignments,
    cells: submissions.map((submission) => ({
      assignmentId: submission.assignmentId,
      studentId: submission.studentId,
      grade: submission.grade,
      state: submission.status,
    })),
  };
}

/** A student's own grades across a course. */
export async function getStudentGrades(courseId: string) {
  const context = await requireCourseAccess(courseId);

  const assignments = await prisma.assignment.findMany({
    where: { courseId, type: { not: "MATERIAL" }, published: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      maxPoints: true,
      dueDate: true,
      submissions: {
        where: { studentId: context.user.id },
        select: { id: true, status: true, grade: true, submittedAt: true },
      },
    },
  });

  return assignments.map(({ submissions, ...assignment }) => ({
    ...assignment,
    submission: submissions[0] ?? null,
  }));
}
