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
    uploadedById: true,
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
export async function listAnnouncements(
  courseId: string,
): Promise<
  Array<{
    id: string;
    content: string;
    pinned: boolean;
    createdAt: Date;
    authorId: string;
    author: { id: string; displayName: string | null; email: string; avatarUrl: string | null };
    attachments: Array<{ id: string; name: string; url: string; mimeType: string | null; size: number; uploadedById: string }>;
    comments: Array<{
      id: string;
      content: string;
      createdAt: Date;
      authorId: string;
      author: { id: string; displayName: string | null; email: string; avatarUrl: string | null };
    }>;
  }>
> {
  const started = Date.now();
  await requireCourseAccess(courseId);

  const rows = await prisma.announcement.findMany({
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
  // #region agent log
  fetch('http://127.0.0.1:7828/ingest/62b85801-70a6-40cf-a67e-0e8937ac4fa4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'214fb7'},body:JSON.stringify({sessionId:'214fb7',hypothesisId:'D',location:'src/lib/data/stream.ts:listAnnouncements',message:'announcement query',data:{ms:Date.now()-started,rowCount:rows.length,commentCount:rows.reduce((n,row)=>n+row.comments.length,0),attachmentCount:rows.reduce((n,row)=>n+row.attachments.length,0)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return rows;
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
