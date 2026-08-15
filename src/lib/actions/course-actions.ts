"use server";

import { db } from "@/db";
import { courses, enrollments, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { createCourseSchema, joinCourseSchema } from "@/lib/validators";
import { generateJoinCode, randomThemeColor } from "@/lib/utils";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

export type ActionState = {
  error?: string;
  success?: boolean;
};

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };
  if (user.role !== "teacher" && user.role !== "admin") {
    return { error: "Only teachers can create courses" };
  }

  const raw = {
    name: formData.get("name") as string,
    section: (formData.get("section") as string) || undefined,
    subject: (formData.get("subject") as string) || undefined,
    room: (formData.get("room") as string) || undefined,
  };

  const parsed = createCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const joinCode = generateJoinCode();

  const [course] = await db
    .insert(courses)
    .values({
      ...parsed.data,
      joinCode,
      themeColor: randomThemeColor(),
      createdById: user.id,
    })
    .returning({ id: courses.id });

  await db.insert(enrollments).values({
    userId: user.id,
    courseId: course.id,
    role: "teacher",
  });

  revalidatePath("/dashboard");
  redirect(`/course/${course.id}`);
}

export async function joinCourseAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  const raw = {
    joinCode: ((formData.get("joinCode") as string) || "").toUpperCase(),
  };

  const parsed = joinCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid join code" };
  }

  const [course] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(eq(courses.joinCode, parsed.data.joinCode))
    .limit(1);

  if (!course) {
    return { error: "No course found with that join code" };
  }

  const existing = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, user.id),
        eq(enrollments.courseId, course.id)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return { error: "You are already enrolled in this course" };
  }

  const enrollRole = user.role === "teacher" ? "teacher" as const : "student" as const;

  await db.insert(enrollments).values({
    userId: user.id,
    courseId: course.id,
    role: enrollRole,
  });

  revalidatePath("/dashboard");
  redirect(`/course/${course.id}`);
}

export async function archiveCourseAction(courseId: number): Promise<ActionState> {
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
    return { error: "Only teachers can archive courses" };
  }

  await db
    .update(courses)
    .set({ archived: true, updatedAt: new Date() })
    .where(eq(courses.id, courseId));

  revalidatePath("/dashboard");
  return { success: true };
}

export async function getUserCourses() {
  const user = await getCurrentUser();
  if (!user) return [];

  const result = await db
    .select({
      id: courses.id,
      name: courses.name,
      section: courses.section,
      subject: courses.subject,
      room: courses.room,
      joinCode: courses.joinCode,
      themeColor: courses.themeColor,
      archived: courses.archived,
      enrollmentRole: enrollments.role,
      creatorName: users.name,
    })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .innerJoin(users, eq(courses.createdById, users.id))
    .where(eq(enrollments.userId, user.id));

  return result;
}

export async function getCourseById(courseId: number) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [enrollment] = await db
    .select({ role: enrollments.role })
    .from(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    )
    .limit(1);

  if (!enrollment) return null;

  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      section: courses.section,
      subject: courses.subject,
      room: courses.room,
      joinCode: courses.joinCode,
      themeColor: courses.themeColor,
      archived: courses.archived,
      createdById: courses.createdById,
    })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) return null;

  return { ...course, userRole: enrollment.role };
}

export async function getCourseMembers(courseId: number) {
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
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarColor: users.avatarColor,
      role: enrollments.role,
      joinedAt: enrollments.joinedAt,
    })
    .from(enrollments)
    .innerJoin(users, eq(enrollments.userId, users.id))
    .where(eq(enrollments.courseId, courseId));
}

export async function unenrollAction(courseId: number): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Not authenticated" };

  await db
    .delete(enrollments)
    .where(
      and(eq(enrollments.userId, user.id), eq(enrollments.courseId, courseId))
    );

  revalidatePath("/dashboard");
  return { success: true };
}
