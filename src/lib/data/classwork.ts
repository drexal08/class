import "server-only";

import { requireCourseAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const attachmentSelect = {
  select: { id: true, name: true, url: true, mimeType: true, size: true },
} as const;

export type ClassworkItem = Awaited<ReturnType<typeof listAssignments>>[number];

export async function listTopics(courseId: string) {
  await requireCourseAccess(courseId);

  return prisma.topic.findMany({
    where: { courseId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    select: { id: true, name: true, sortOrder: true },
  });
}

/**
 * Classwork for the course.
 *
 * Students only ever see published items; the draft filter is applied in the
 * query so an unpublished assignment is never serialised to the client.
 */
export async function listAssignments(courseId: string) {
  const context = await requireCourseAccess(courseId);

  const assignments = await prisma.assignment.findMany({
    where: {
      courseId,
      ...(context.isTeacher ? {} : { published: true }),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      dueDate: true,
      maxPoints: true,
      topicId: true,
      published: true,
      createdAt: true,
      _count: { select: { submissions: true } },
      submissions: context.isTeacher
        ? {
            where: { status: { in: ["SUBMITTED", "LATE", "GRADED", "RETURNED"] } },
            select: { id: true },
          }
        : {
            where: { studentId: context.user.id },
            select: { id: true, status: true, grade: true },
          },
    },
  });

  return assignments.map((assignment) => {
    const { submissions, ...rest } = assignment;
    return {
      ...rest,
      // For a teacher this is the turned-in count; for a student it is their
      // own submission, if any.
      turnedInCount: context.isTeacher ? submissions.length : 0,
      mySubmission: context.isTeacher
        ? null
        : ((submissions[0] as
            | { id: string; status: ClassworkStatus; grade: number | null }
            | undefined) ?? null),
    };
  });
}

type ClassworkStatus = "ASSIGNED" | "SUBMITTED" | "LATE" | "GRADED" | "RETURNED";

/**
 * A single assignment, scoped to its course in the `where` clause so an id from
 * another class simply does not resolve.
 */
export async function getAssignment(courseId: string, assignmentId: string) {
  const context = await requireCourseAccess(courseId);

  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      courseId,
      ...(context.isTeacher ? {} : { published: true }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      dueDate: true,
      maxPoints: true,
      published: true,
      createdAt: true,
      courseId: true,
      topic: { select: { id: true, name: true } },
      attachments: attachmentSelect,
      rubric: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          title: true,
          description: true,
          points: true,
          sortOrder: true,
        },
      },
      _count: { select: { submissions: true } },
    },
  });
  if (!assignment) return null;

  return { ...assignment, viewerIsTeacher: context.isTeacher };
}

/** The signed-in student's own submission. Never takes a studentId argument. */
export async function getOwnSubmission(courseId: string, assignmentId: string) {
  const context = await requireCourseAccess(courseId);

  return prisma.submission.findFirst({
    where: {
      assignmentId,
      studentId: context.user.id,
      assignment: { courseId },
    },
    select: {
      id: true,
      status: true,
      grade: true,
      feedback: true,
      content: true,
      fileUrl: true,
      submittedAt: true,
      gradedAt: true,
      returnedAt: true,
      attachments: attachmentSelect,
      rubricScores: {
        select: { id: true, criterionId: true, points: true },
      },
    },
  });
}
