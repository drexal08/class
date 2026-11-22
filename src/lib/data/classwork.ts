import "server-only";

import { requireCourseAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import {
  visibleFeedbackForStudent,
  visibleGradeForStudent,
} from "@/lib/rules";

const attachmentSelect = {
  select: {
    id: true,
    name: true,
    url: true,
    mimeType: true,
    size: true,
    uploadedById: true,
  },
} as const;

export type ClassworkItem = Awaited<ReturnType<typeof listAssignments>>[number];

export async function listTopics(
  courseId: string,
): Promise<Array<{ id: string; name: string; sortOrder: number }>> {
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
export async function listAssignments(
  courseId: string,
): Promise<
  Array<{
    id: string;
    title: string;
    description: string | null;
    type: import("@/generated/prisma/client").$Enums.AssignmentType;
    dueDate: Date | null;
    maxPoints: number;
    topicId: string | null;
    published: boolean;
    createdAt: Date;
    turnedInCount: number;
    mySubmission:
      | {
          id: string;
          status: import("@/generated/prisma/client").$Enums.SubmissionState;
          grade: number | null;
        }
      | null;
  }>
> {
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
            select: { id: true, status: true, grade: true },
          }
        : {
            where: { studentId: context.user.id },
            select: { id: true, status: true, grade: true },
          },
    },
  });

  return assignments.map((assignment: {
    submissions: Array<{ id: string; status: import("@/generated/prisma/client").$Enums.SubmissionState; grade: number | null }>;
    id: string;
    title: string;
    description: string | null;
    type: import("@/generated/prisma/client").$Enums.AssignmentType;
    dueDate: Date | null;
    maxPoints: number;
    published: boolean;
    acceptingSubmissions: boolean;
    allowLateSubmissions: boolean;
    createdAt: Date;
    courseId: string;
    topic: { id: string; name: string } | null;
    attachments: Array<{ id: string; name: string; url: string; mimeType: string | null; size: number; uploadedById: string }>;
    rubric: Array<{ id: string; title: string; description: string | null; points: number; sortOrder: number }>;
    _count: { submissions: number };
  }) => {
    const { submissions, ...rest } = assignment;
    // Both branches select the same columns, so the row type is stable; only
    // the filter differs.
    const mine = context.isTeacher ? null : (submissions[0] ?? null);

    return {
      ...rest,
      // For a teacher this is the turned-in count; for a student it is their
      // own submission, if any.
      turnedInCount: context.isTeacher ? submissions.length : 0,
      mySubmission: mine
        ? {
            ...mine,
            // A saved grade is not visible until the teacher returns it.
            grade: visibleGradeForStudent(mine.status, mine.grade),
          }
        : null,
    };
  });
}

/**
 * A single assignment, scoped to its course in the `where` clause so an id from
 * another class simply does not resolve.
 */
export async function getAssignment(
  courseId: string,
  assignmentId: string,
): Promise<
  | (null | {
      id: string;
      title: string;
      description: string | null;
      type: import("@/generated/prisma/client").$Enums.AssignmentType;
      dueDate: Date | null;
      maxPoints: number;
      published: boolean;
      acceptingSubmissions: boolean;
      allowLateSubmissions: boolean;
      createdAt: Date;
      courseId: string;
      topic: { id: string; name: string } | null;
      attachments: Array<{ id: string; name: string; url: string; mimeType: string | null; size: number; uploadedById: string }>;
      rubric: Array<{ id: string; title: string; description: string | null; points: number; sortOrder: number }>;
      _count: { submissions: number };
      viewerIsTeacher: boolean;
    })
> {
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
      acceptingSubmissions: true,
      allowLateSubmissions: true,
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

  const submission = await prisma.submission.findFirst({
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
      submittedAt: true,
      gradedAt: true,
      returnedAt: true,
      attachments: attachmentSelect,
      rubricScores: {
        select: { id: true, criterionId: true, points: true },
      },
    },
  });
  if (!submission) return null;

  return {
    ...submission,
    // Marks and feedback stay hidden until the teacher returns the work.
    grade: visibleGradeForStudent(submission.status, submission.grade),
    feedback: visibleFeedbackForStudent(submission.status, submission.feedback),
  };
}
