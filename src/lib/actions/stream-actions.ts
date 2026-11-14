"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  assertCanComment,
  assertCanPost,
  requireActiveCourse,
  requireActiveCourseManager,
  runAction,
} from "@/lib/auth/guards";
import { notifyCourse } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish } from "@/lib/realtime/server";
import { deleteObject } from "@/lib/storage/s3";
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
    const context = await requireActiveCourse(courseId);
    if (context.muted) {
      throw new AuthError("You have been muted in this class");
    }
    assertCanPost(context);

    const announcement = await prisma.announcement.create({
      data: { courseId, content, authorId: context.user.id },
      select: { id: true },
    });

    revalidatePath(`/course/${courseId}`);
    await publish(courseChannel(courseId), "announcement:new", {
      actorId: context.user.id,
      id: announcement.id,
    });
    await notifyCourse({
      courseId,
      type: "ANNOUNCEMENT_POSTED",
      title: `New post in ${context.courseName}`,
      body: content.length > 140 ? `${content.slice(0, 140)}…` : content,
      linkPath: `/course/${courseId}`,
      actorId: context.user.id,
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
    await requireActiveCourseManager(courseId);

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
    const context = await requireActiveCourseManager(courseId);

    const announcement = await prisma.announcement.findFirst({
      where: { id: announcementId, courseId },
      select: { attachments: { select: { key: true } } },
    });
    if (!announcement) return { error: "That post no longer exists" };

    await prisma.announcement.delete({ where: { id: announcementId } });
    await Promise.all(
      announcement.attachments.map((attachment) =>
        deleteObject(attachment.key),
      ),
    );

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

    const context = await requireActiveCourse(courseId);

    // Stream policy governs public class comments. A private comment between a
    // student and their teacher is not a stream post, so a teacher-only class
    // (or a muted student) must not block it.
    if (!submissionId) {
      if (context.muted) {
        throw new AuthError("You have been muted in this class");
      }
      assertCanComment(context);
    }

    // Each target is verified to belong to this course before we write, so a
    // valid session cannot comment into a class it isn't a member of.
    let announcementAuthorId: string | null = null;
    if (announcementId) {
      const announcement = await prisma.announcement.findFirst({
        where: { id: announcementId, courseId },
        select: { authorId: true },
      });
      if (!announcement) return { error: "That post no longer exists" };
      announcementAuthorId = announcement.authorId;
    }

    if (assignmentId) {
      const exists = await prisma.assignment.count({
        where: { id: assignmentId, courseId },
      });
      if (!exists) return { error: "That assignment no longer exists" };
    }

    let submissionStudentId: string | null = null;
    let isPrivate = false;
    if (submissionId) {
      const submission = await prisma.submission.findFirst({
        where: { id: submissionId, assignment: { courseId } },
        select: { studentId: true },
      });
      if (!submission) return { error: "That submission no longer exists" };

      const isOwner = submission.studentId === context.user.id;
      if (!isOwner && !context.canManage) {
        throw new AuthError("You cannot comment on this submission");
      }
      // Comments on a submission are always private feedback.
      isPrivate = true;
      submissionStudentId = submission.studentId;
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

    // Tell the person who owns the thread, not the whole class.
    const recipients = new Set<string>();
    if (announcementAuthorId) recipients.add(announcementAuthorId);
    if (assignmentId && context.teacherId) recipients.add(context.teacherId);
    if (submissionId) {
      if (submissionStudentId) recipients.add(submissionStudentId);
      if (context.teacherId) recipients.add(context.teacherId);
    }
    recipients.delete(context.user.id);

    if (recipients.size > 0) {
      await notifyCourse({
        courseId,
        type: "COMMENT_ADDED",
        title: `New comment in ${context.courseName}`,
        body: content.length > 140 ? `${content.slice(0, 140)}…` : content,
        linkPath: assignmentId
          ? `/course/${courseId}/classwork/${assignmentId}`
          : `/course/${courseId}`,
        actorId: context.user.id,
        recipientIds: [...recipients],
      });
    }
  });
}

export async function deleteCommentAction(
  courseId: string,
  commentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireActiveCourse(courseId);

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
    if (comment.authorId !== context.user.id && !context.canManage) {
      throw new AuthError("You can only delete your own comments");
    }

    await prisma.comment.delete({ where: { id: commentId } });
    revalidatePath(`/course/${courseId}`);
  });
}
