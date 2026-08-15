"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  requireCourseAccess,
  requireCourseTeacher,
  runAction,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish } from "@/lib/realtime/server";
import type { ActionState } from "@/lib/types";
import { commentSchema, createAnnouncementSchema, firstIssue } from "@/lib/validators";

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createAnnouncementSchema.safeParse({
      courseId: formData.get("courseId"),
      content: formData.get("content"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, content } = parsed.data;
    const context = await requireCourseAccess(courseId);
    if (context.muted) {
      throw new AuthError("You have been muted in this class");
    }

    const announcement = await prisma.announcement.create({
      data: { courseId, content, authorId: context.user.id },
      select: { id: true },
    });

    revalidatePath(`/course/${courseId}`);
    await publish(courseChannel(courseId), "announcement:new", {
      actorId: context.user.id,
      id: announcement.id,
    });
  });
}

/**
 * The client sends the state it wants rather than a toggle.
 *
 * Reading the current value and writing its negation is a lost-update race when
 * two teachers act at once; this is idempotent.
 */
export async function setAnnouncementPinnedAction(
  courseId: string,
  announcementId: string,
  pinned: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    // Scoping the write by courseId is both the authorization check and the
    // fix for acting on another class's announcement.
    await prisma.announcement.updateMany({
      where: { id: announcementId, courseId },
      data: { pinned },
    });

    revalidatePath(`/course/${courseId}`);
  });
}

export async function deleteAnnouncementAction(
  courseId: string,
  announcementId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireCourseTeacher(courseId);

    await prisma.announcement.deleteMany({
      where: { id: announcementId, courseId },
    });

    revalidatePath(`/course/${courseId}`);
    await publish(courseChannel(courseId), "announcement:deleted", {
      actorId: context.user.id,
      id: announcementId,
    });
  });
}

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = commentSchema.safeParse({
      content: formData.get("content"),
      courseId: formData.get("courseId"),
      announcementId: formData.get("announcementId") ?? undefined,
      assignmentId: formData.get("assignmentId") ?? undefined,
      submissionId: formData.get("submissionId") ?? undefined,
      isPrivate: formData.get("isPrivate") === "true",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, content, announcementId, assignmentId, submissionId } =
      parsed.data;

    const context = await requireCourseAccess(courseId);
    if (context.muted) {
      throw new AuthError("You have been muted in this class");
    }

    // Each target is verified to belong to this course before we write, so a
    // valid session cannot comment into a class it isn't a member of.
    if (announcementId) {
      const exists = await prisma.announcement.count({
        where: { id: announcementId, courseId },
      });
      if (!exists) return { error: "That post no longer exists" };
    }

    if (assignmentId) {
      const exists = await prisma.assignment.count({
        where: { id: assignmentId, courseId },
      });
      if (!exists) return { error: "That assignment no longer exists" };
    }

    let isPrivate = false;
    if (submissionId) {
      const submission = await prisma.submission.findFirst({
        where: { id: submissionId, assignment: { courseId } },
        select: { studentId: true },
      });
      if (!submission) return { error: "That submission no longer exists" };

      const isOwner = submission.studentId === context.user.id;
      if (!isOwner && !context.isTeacher) {
        throw new AuthError("You cannot comment on this submission");
      }
      // Comments on a submission are always private feedback.
      isPrivate = true;
    }

    await prisma.comment.create({
      data: {
        content,
        authorId: context.user.id,
        announcementId: announcementId ?? null,
        assignmentId: assignmentId ?? null,
        submissionId: submissionId ?? null,
        isPrivate,
      },
    });

    revalidatePath(`/course/${courseId}`);
    if (assignmentId) {
      revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
    }

    await publish(courseChannel(courseId), "comment:new", {
      actorId: context.user.id,
    });
  });
}

export async function deleteCommentAction(
  courseId: string,
  commentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireCourseAccess(courseId);

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        authorId: true,
        announcement: { select: { courseId: true } },
        assignment: { select: { courseId: true } },
        submission: { select: { assignment: { select: { courseId: true } } } },
      },
    });
    if (!comment) return { error: "That comment no longer exists" };

    const commentCourseId =
      comment.announcement?.courseId ??
      comment.assignment?.courseId ??
      comment.submission?.assignment.courseId;

    if (commentCourseId !== courseId) {
      throw new AuthError("That comment belongs to another class");
    }

    // Authors delete their own comments; teachers moderate anyone's.
    if (comment.authorId !== context.user.id && !context.isTeacher) {
      throw new AuthError("You can only delete your own comments");
    }

    await prisma.comment.delete({ where: { id: commentId } });
    revalidatePath(`/course/${courseId}`);
  });
}
