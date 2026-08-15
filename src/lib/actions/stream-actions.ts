"use server";

import { db } from "@/db";
import { announcements, comments, enrollments, users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { createAnnouncementSchema, createCommentSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";

export type ActionState = {
  error?: string;
  success?: boolean;
};

export async function createAnnouncementAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const courseId = Number(formData.get("courseId"));
  const content = formData.get("content") as string;

  const parsed = createAnnouncementSchema.safeParse({ courseId, content });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  // Verify enrollment
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment) return { error: "Not enrolled in this course" };

  await db.insert(announcements).values({
    courseId: parsed.data.courseId,
    authorId: user.id,
    content: parsed.data.content,
  });

  revalidatePath(`/course/${courseId}`);
  return { success: true };
}

export async function getAnnouncements(courseId: number) {
  const user = await getCurrentUser();
  if (!user) return [];

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment) return [];

  return db
    .select({
      id: announcements.id,
      content: announcements.content,
      pinned: announcements.pinned,
      createdAt: announcements.createdAt,
      authorName: users.name,
      authorColor: users.avatarColor,
      authorId: users.id,
    })
    .from(announcements)
    .innerJoin(users, eq(announcements.authorId, users.id))
    .where(eq(announcements.courseId, courseId))
    .orderBy(desc(announcements.pinned), desc(announcements.createdAt));
}

export async function togglePinAction(
  announcementId: number,
  courseId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can pin announcements" };
  }

  const [ann] = await db
    .select({ pinned: announcements.pinned })
    .from(announcements)
    .where(eq(announcements.id, announcementId))
    .limit(1);

  if (!ann) return { error: "Announcement not found" };

  await db
    .update(announcements)
    .set({ pinned: !ann.pinned, updatedAt: new Date() })
    .where(eq(announcements.id, announcementId));

  revalidatePath(`/course/${courseId}`);
  return { success: true };
}

export async function deleteAnnouncementAction(
  announcementId: number,
  courseId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment || enrollment.role !== "teacher") {
    return { error: "Only teachers can delete announcements" };
  }

  await db.delete(announcements).where(eq(announcements.id, announcementId));
  revalidatePath(`/course/${courseId}`);
  return { success: true };
}

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const content = formData.get("content") as string;
  const announcementId = formData.get("announcementId")
    ? Number(formData.get("announcementId"))
    : undefined;
  const assignmentId = formData.get("assignmentId")
    ? Number(formData.get("assignmentId"))
    : undefined;
  const submissionId = formData.get("submissionId")
    ? Number(formData.get("submissionId"))
    : undefined;
  const courseId = Number(formData.get("courseId"));

  const parsed = createCommentSchema.safeParse({
    content,
    announcementId,
    assignmentId,
    submissionId,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  await db.insert(comments).values({
    authorId: user.id,
    content: parsed.data.content,
    announcementId: parsed.data.announcementId ?? null,
    assignmentId: parsed.data.assignmentId ?? null,
    submissionId: parsed.data.submissionId ?? null,
  });

  revalidatePath(`/course/${courseId}`);
  return { success: true };
}

export async function getComments(
  announcementId?: number,
  assignmentId?: number,
  submissionId?: number
) {
  if (announcementId) {
    return db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
        authorId: users.id,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.announcementId, announcementId))
      .orderBy(comments.createdAt);
  }
  if (assignmentId) {
    return db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
        authorId: users.id,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.assignmentId, assignmentId))
      .orderBy(comments.createdAt);
  }
  if (submissionId) {
    return db
      .select({
        id: comments.id,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: users.name,
        authorColor: users.avatarColor,
        authorId: users.id,
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.submissionId, submissionId))
      .orderBy(comments.createdAt);
  }
  return [];
}

export async function deleteCommentAction(
  commentId: number,
  courseId: number
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const [comment] = await db
    .select({ authorId: comments.authorId })
    .from(comments)
    .where(eq(comments.id, commentId))
    .limit(1);

  if (!comment) return { error: "Comment not found" };

  // Check if user is the author or a teacher
  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (comment.authorId !== user.id && enrollment?.role !== "teacher") {
    return { error: "Cannot delete this comment" };
  }

  await db.delete(comments).where(eq(comments.id, commentId));
  revalidatePath(`/course/${courseId}`);
  return { success: true };
}
