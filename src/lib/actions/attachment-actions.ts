"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  requireActiveCourse,
  runAction,
  type CourseContext,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { attachmentKeyBelongsToCourse } from "@/lib/rules";
import { deleteObject } from "@/lib/storage/s3";
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
    const context = await requireActiveCourse(courseId);

    const parsed = attachmentMetaSchema.safeParse(meta);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    // The browser only ever sees a key the presign route minted for this
    // course. Refusing anything else stops a crafted request from attaching a
    // row to another class's object.
    if (
      !attachmentKeyBelongsToCourse(parsed.data.key, courseId, target.scope)
    ) {
      throw new AuthError("That upload does not belong to this class");
    }

    await assertTargetInCourse(context, target);

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
    const context = await requireActiveCourse(courseId);

    // Resolve the attachment *through* its parent and the parent's course.
    // Looking it up by id alone let a teacher of one class delete another
    // class's file.
    const attachment = await prisma.attachment.findFirst({
      where: {
        id: attachmentId,
        OR: [
          { announcement: { courseId } },
          { assignment: { courseId } },
          { submission: { assignment: { courseId } } },
        ],
      },
      select: {
        id: true,
        key: true,
        uploadedById: true,
        submission: { select: { status: true } },
      },
    });
    if (!attachment) return { error: "That file no longer exists" };

    if (attachment.uploadedById !== context.user.id && !context.canManage) {
      throw new AuthError("You can only remove files you uploaded");
    }

    // Once work is marked, the files it was marked on are part of the record.
    if (
      attachment.submission &&
      !context.canManage &&
      (attachment.submission.status === "GRADED" ||
        attachment.submission.status === "RETURNED")
    ) {
      throw new AuthError("Marked work can no longer be changed");
    }

    await prisma.attachment.delete({ where: { id: attachmentId } });
    await deleteObject(attachment.key);

    revalidatePath(`/course/${courseId}`);
  });
}

/** Proves the attachment's parent really belongs to this course. */
async function assertTargetInCourse(
  context: CourseContext,
  target: AttachmentTarget,
): Promise<void> {
  if (target.scope === "announcement") {
    const announcement = await prisma.announcement.findFirst({
      where: { id: target.id, courseId: context.courseId },
      select: { authorId: true },
    });
    if (!announcement) throw new AuthError("That post no longer exists");
    if (announcement.authorId !== context.user.id && !context.canManage) {
      throw new AuthError("You can only attach files to your own post");
    }
    return;
  }

  if (target.scope === "assignment") {
    if (!context.canManage) {
      throw new AuthError("Only teachers can attach files to classwork");
    }
    const count = await prisma.assignment.count({
      where: { id: target.id, courseId: context.courseId },
    });
    if (!count) throw new AuthError("That assignment no longer exists");
    return;
  }

  const submission = await prisma.submission.findFirst({
    where: { id: target.id, assignment: { courseId: context.courseId } },
    select: { studentId: true, status: true },
  });
  if (!submission) throw new AuthError("That submission no longer exists");
  if (submission.studentId !== context.user.id && !context.canManage) {
    throw new AuthError("You can only attach files to your own work");
  }
  if (
    !context.canManage &&
    (submission.status === "GRADED" || submission.status === "RETURNED")
  ) {
    throw new AuthError("Marked work can no longer be changed");
  }
}
