import "server-only";

import { requireCourseAccess } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const authorSelect = {
  select: {
    id: true,
    displayName: true,
    email: true,
    avatarUrl: true,
  },
} as const;

const attachmentSelect = {
  select: {
    id: true,
    name: true,
    url: true,
    mimeType: true,
    size: true,
  },
} as const;

export type StreamAnnouncement = Awaited<
  ReturnType<typeof listAnnouncements>
>[number];

/**
 * The stream, with comments included.
 *
 * Comments come back in the same query rather than being fetched per-card from
 * the client — the previous approach issued one request per announcement and
 * left every thread showing "Loading…" on first paint.
 */
export async function listAnnouncements(courseId: string) {
  await requireCourseAccess(courseId);

  return prisma.announcement.findMany({
    where: { courseId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: 50,
    select: {
      id: true,
      content: true,
      pinned: true,
      createdAt: true,
      authorId: true,
      author: authorSelect,
      attachments: attachmentSelect,
      comments: {
        where: { isPrivate: false },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          content: true,
          createdAt: true,
          authorId: true,
          author: authorSelect,
        },
      },
    },
  });
}

/** Class comments on a piece of classwork. Never includes private feedback. */
export async function listAssignmentComments(
  courseId: string,
  assignmentId: string,
) {
  await requireCourseAccess(courseId);

  return prisma.comment.findMany({
    where: { assignmentId, isPrivate: false, assignment: { courseId } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      author: authorSelect,
    },
  });
}

/**
 * Private teacher↔student comments on one submission.
 *
 * Readable only by the student who owns the work and by teachers of the course
 * — this is the check the original code was missing entirely.
 */
export async function listPrivateComments(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, studentId: true, assignment: { select: { courseId: true } } },
  });
  if (!submission) return [];

  const context = await requireCourseAccess(submission.assignment.courseId);
  const isOwner = context.user.id === submission.studentId;
  if (!isOwner && !context.isTeacher) return [];

  return prisma.comment.findMany({
    where: { submissionId, isPrivate: true },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      content: true,
      createdAt: true,
      authorId: true,
      author: authorSelect,
    },
  });
}
