"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  requireCourseAccess,
  runAction,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { deleteObject } from "@/lib/storage/r2";
import type { ActionState } from "@/lib/types";
import { attachmentMetaSchema, firstIssue } from "@/lib/validators";

type AttachmentTarget =
  | { scope: "announcement"; id: string }
  | { scope: "assignment"; id: string }
  | { scope: "submission"; id: string };

/**
 * Records an upload after the browser has PUT the file straight to the bucket.
 *
 * The file never passes through this server; only its metadata is persisted,
 * which is what keeps large attachments off the serverless request body limit.
 */
export async function saveAttachmentAction(
  courseId: string,
  target: AttachmentTarget,
  meta: unknown,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireCourseAccess(courseId);

    const parsed = attachmentMetaSchema.safeParse(meta);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    await assertTargetInCourse(courseId, target, context.user.id, context.isTeacher);

    // `key` is the durable reference. `url` is retained only as a record of
    // where the object was written — rendering always goes through
    // /api/files/[id], which re-signs on demand after checking permission.
    await prisma.attachment.create({
      data: {
        name: parsed.data.name,
        url: parsed.data.url,
        key: parsed.data.key,
        mimeType: parsed.data.mimeType ?? null,
        size: parsed.data.size ?? null,
        uploadedById: context.user.id,
        announcementId: target.scope === "announcement" ? target.id : null,
        assignmentId: target.scope === "assignment" ? target.id : null,
        submissionId: target.scope === "submission" ? target.id : null,
      },
    });

    revalidatePath(`/course/${courseId}`);
  });
}

export async function deleteAttachmentAction(
  courseId: string,
  attachmentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireCourseAccess(courseId);

    const attachment = await prisma.attachment.findUnique({
      where: { id: attachmentId },
      select: { id: true, key: true, uploadedById: true },
    });
    if (!attachment) return { error: "That file no longer exists" };

    if (attachment.uploadedById !== context.user.id && !context.isTeacher) {
      throw new AuthError("You can only remove files you uploaded");
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await deleteObject(attachment.key);

    revalidatePath(`/course/${courseId}`);
  });
}

/** Proves the attachment's parent really belongs to this course. */
async function assertTargetInCourse(
  courseId: string,
  target: AttachmentTarget,
  userId: string,
  isTeacher: boolean,
): Promise<void> {
  if (target.scope === "announcement") {
    const count = await prisma.announcement.count({
      where: { id: target.id, courseId },
    });
    if (!count) throw new AuthError("That post no longer exists");
    return;
  }

  if (target.scope === "assignment") {
    if (!isTeacher) {
      throw new AuthError("Only teachers can attach files to classwork");
    }
    const count = await prisma.assignment.count({
      where: { id: target.id, courseId },
    });
    if (!count) throw new AuthError("That assignment no longer exists");
    return;
  }

  const submission = await prisma.submission.findFirst({
    where: { id: target.id, assignment: { courseId } },
    select: { studentId: true },
  });
  if (!submission) throw new AuthError("That submission no longer exists");
  if (submission.studentId !== userId) {
    throw new AuthError("You can only attach files to your own work");
  }
}
