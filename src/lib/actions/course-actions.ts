"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  AuthError,
  requireCourseAccess,
  requireCourseTeacher,
  requireUser,
  runAction,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";
import { generateJoinCode, randomAccent } from "@/lib/utils";
import {
  createCourseSchema,
  firstIssue,
  joinCourseSchema,
  updateCourseSchema,
} from "@/lib/validators";

/**
 * Only mutations live in this file. Every export of a `"use server"` module is
 * a publicly callable endpoint, so reads belong in `src/lib/data/*` instead.
 */

export async function createCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let createdId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();
    if (user.role === "STUDENT") {
      throw new AuthError("Only teachers can create classes");
    }

    const parsed = createCourseSchema.safeParse({
      name: formData.get("name"),
      section: formData.get("section"),
      subject: formData.get("subject"),
      room: formData.get("room"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const course = await createCourseWithUniqueCode(user.id, parsed.data);
    createdId = course.id;
  });

  if (result.error) return result;

  revalidatePath("/dashboard");
  if (createdId) redirect(`/course/${createdId}`);
  return { success: true };
}

/**
 * Join codes are random, so collisions are rare but not impossible. Retrying on
 * the unique-constraint violation is cheaper and more correct than pre-checking,
 * which would still race.
 */
async function createCourseWithUniqueCode(
  teacherId: string,
  data: { name: string; section?: string; subject?: string; room?: string },
) {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      // The course and its teacher enrollment must land together, or the
      // creator ends up locked out of their own class.
      return await prisma.$transaction(async (tx) => {
        const course = await tx.course.create({
          data: {
            ...data,
            code: generateJoinCode(),
            accent: randomAccent(),
            teacherId,
          },
          select: { id: true },
        });

        await tx.enrollment.create({
          data: { courseId: course.id, userId: teacherId, role: "TEACHER" },
        });

        return course;
      });
    } catch (error) {
      if (isUniqueViolation(error, "code")) continue;
      throw error;
    }
  }

  throw new Error("Could not generate a unique class code. Please try again.");
}

export async function joinCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let joinedId: string | null = null;

  const result = await runAction(async () => {
    const user = await requireUser();

    const parsed = joinCourseSchema.safeParse({ code: formData.get("code") });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const course = await prisma.course.findUnique({
      where: { code: parsed.data.code },
      select: { id: true, archived: true, teacherId: true },
    });
    if (!course) return { error: "No class found with that code" };
    if (course.archived) return { error: "That class has been archived" };

    try {
      await prisma.enrollment.create({
        data: {
          courseId: course.id,
          userId: user.id,
          // A teacher joining someone else's class joins as a student; only the
          // owner and explicitly promoted users teach.
          role: course.teacherId === user.id ? "TEACHER" : "STUDENT",
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { error: "You are already in this class" };
      }
      throw error;
    }

    joinedId = course.id;
  });

  if (result.error) return result;

  revalidatePath("/dashboard");
  if (joinedId) redirect(`/course/${joinedId}`);
  return { success: true };
}

export async function updateCourseAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = updateCourseSchema.safeParse({
      courseId: formData.get("courseId"),
      name: formData.get("name"),
      section: formData.get("section"),
      subject: formData.get("subject"),
      room: formData.get("room"),
      description: formData.get("description"),
      postPolicy: formData.get("postPolicy") ?? undefined,
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, ...data } = parsed.data;
    await requireCourseTeacher(courseId);

    await prisma.course.update({
      where: { id: courseId },
      data: {
        name: data.name,
        section: data.section ?? null,
        subject: data.subject ?? null,
        room: data.room ?? null,
        description: data.description ?? null,
        postPolicy: data.postPolicy,
      },
    });

    revalidatePath(`/course/${courseId}`);
    revalidatePath("/dashboard");
  });
}

export async function setArchivedAction(
  courseId: string,
  archived: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    await prisma.course.update({ where: { id: courseId }, data: { archived } });

    revalidatePath("/dashboard");
    revalidatePath(`/course/${courseId}`);
  });
}

export async function regenerateJoinCodeAction(
  courseId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await prisma.course.update({
          where: { id: courseId },
          data: { code: generateJoinCode() },
        });
        revalidatePath(`/course/${courseId}`);
        return;
      } catch (error) {
        if (isUniqueViolation(error, "code")) continue;
        throw error;
      }
    }

    throw new Error("Could not generate a new code. Please try again.");
  });
}

/** Teacher removes someone from the roster. */
export async function removeMemberAction(
  courseId: string,
  userId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });
    if (course?.teacherId === userId) {
      return { error: "The class owner cannot be removed" };
    }

    await prisma.enrollment.deleteMany({ where: { courseId, userId } });
    revalidatePath(`/course/${courseId}/people`);
  });
}

/** Module C moderation: mute or unmute a student's ability to post. */
export async function setMutedAction(
  courseId: string,
  userId: string,
  muted: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    await requireCourseTeacher(courseId);

    await prisma.enrollment.updateMany({
      where: { courseId, userId, role: "STUDENT" },
      data: { muted },
    });

    revalidatePath(`/course/${courseId}/people`);
    revalidatePath(`/course/${courseId}`);
  });
}

export async function leaveCourseAction(courseId: string): Promise<ActionState> {
  const result = await runAction(async () => {
    const context = await requireCourseAccess(courseId);

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { teacherId: true },
    });
    // Leaving as the owner would orphan the class for everyone still in it.
    if (course?.teacherId === context.user.id) {
      return {
        error: "You own this class. Archive it instead of leaving.",
      };
    }

    await prisma.enrollment.deleteMany({
      where: { courseId, userId: context.user.id },
    });
  });

  if (result.error) return result;

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

/** Prisma's unique-constraint violation, optionally on a specific field. */
function isUniqueViolation(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: unknown }).code;
  if (code !== "P2002") return false;
  if (!field) return true;

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target)
    ? target.includes(field)
    : String(target ?? "").includes(field);
}
