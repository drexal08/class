"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActiveCourseManager, runAction } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import {
  gradeItemSchema as createGradeItemInput,
  saveCategoriesSchema,
  scoreInputSchema,
} from "@/lib/school/validation";

/**
 * Gradebook mutations.
 *
 * Every action resolves the course through `requireActiveCourseManager` and
 * then keeps the `courseId` inside the query that fetches the item. Resolving
 * first and checking afterwards is what lets a teacher of one class act on
 * another class's data.
 */

/**
 * Saves one cell. Called directly from the grid (not through a form), so the
 * argument is validated rather than trusted.
 *
 * Deliberately does not call `revalidatePath`: the grid owns optimistic state
 * for the whole table, and refreshing the RSC payload after every keystroke
 * would re-render the grid and steal focus. Lists are `force-dynamic`, so the
 * next navigation reads the database anyway.
 */
export async function saveScoreAction(input: unknown): Promise<ActionState> {
  return runAction(async () => {
    const parsed = scoreInputSchema.safeParse(input);
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, termId, gradeItemId, studentId, score } = parsed.data;
    await requireActiveCourseManager(courseId);

    const [item, enrollment] = await Promise.all([
      prisma.gradeItem.findFirst({
        where: { id: gradeItemId, courseId, termId },
        select: { id: true, maximum: true },
      }),
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: studentId, courseId } },
        select: { role: true },
      }),
    ]);

    if (!item) return { error: "That grade column no longer exists" };
    if (!enrollment || enrollment.role !== "STUDENT") {
      return { error: "That student is not enrolled in this class" };
    }

    if (score === null) {
      await prisma.gradeScore.deleteMany({
        where: { gradeItemId, studentId },
      });
      return { success: true };
    }

    const maximum = Number(item.maximum);
    if (score > maximum) {
      return { error: `The score cannot be more than ${maximum}` };
    }

    await prisma.gradeScore.upsert({
      where: { gradeItemId_studentId: { gradeItemId, studentId } },
      create: { gradeItemId, studentId, score },
      update: { score },
    });
  });
}

export async function createGradeItemAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = createGradeItemInput.safeParse({
      courseId: formData.get("courseId"),
      termId: formData.get("termId"),
      categoryId: formData.get("categoryId"),
      title: formData.get("title"),
      maximum: formData.get("maximum"),
      assessedOn: formData.get("assessedOn"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, termId, categoryId, title, maximum, assessedOn } =
      parsed.data;
    await requireActiveCourseManager(courseId);

    // The category must belong to this course *and* this term.
    const category = await prisma.gradeCategory.findFirst({
      where: { id: categoryId, courseId, termId },
      select: { id: true },
    });
    if (!category) return { error: "That category belongs to another class" };

    await prisma.gradeItem.create({
      data: { courseId, termId, categoryId, title, maximum, assessedOn },
    });

    revalidatePath(`/course/${courseId}/grades`);
  });
}

export async function deleteGradeItemAction(
  courseId: string,
  gradeItemId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireActiveCourseManager(courseId);

    const { count } = await prisma.gradeItem.deleteMany({
      where: { id: gradeItemId, courseId },
    });
    if (count === 0) return { error: "That grade column no longer exists" };

    revalidatePath(`/course/${courseId}/grades`);
  });
}

/**
 * Replaces the category set for one course and term.
 *
 * Categories are edited in place when they carry an id, so their grade items
 * keep pointing at them. A category that was removed from the form is deleted,
 * but only if it has no items — `onDelete: Restrict` would otherwise throw a
 * database error with no useful message.
 */
export async function saveCategorySetAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const ids = formData.getAll("categoryId").map(String);
    const names = formData.getAll("categoryName").map(String);
    const weights = formData.getAll("categoryWeight").map(String);

    const rows = names
      .map((name, index) => ({
        id: ids[index] ?? "",
        name,
        weight: weights[index] ?? "0",
      }))
      .filter((row) => row.name.trim().length > 0 || row.id.length > 0);

    const parsed = saveCategoriesSchema.safeParse({
      courseId: formData.get("courseId"),
      termId: formData.get("termId"),
      categories: rows,
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, termId, categories } = parsed.data;
    await requireActiveCourseManager(courseId);

    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { id: true },
    });
    if (!term) return { error: "That term no longer exists" };

    const existing = await prisma.gradeCategory.findMany({
      where: { courseId, termId },
      select: {
        id: true,
        name: true,
        _count: { select: { items: true } },
      },
    });

    const existingIds = new Set(existing.map((category) => category.id));
    const submittedIds = new Set(
      categories.flatMap((category) => (category.id ? [category.id] : [])),
    );

    for (const category of categories) {
      if (category.id && !existingIds.has(category.id)) {
        return { error: "That category belongs to another class" };
      }
    }

    const removed = existing.filter((category) => !submittedIds.has(category.id));
    const blocked = removed.find((category) => category._count.items > 0);
    if (blocked) {
      return {
        error: `"${blocked.name}" still has grade items. Delete them before removing the category.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      for (const category of categories) {
        if (category.id) {
          await tx.gradeCategory.update({
            where: { id: category.id },
            data: { name: category.name, weight: category.weight },
          });
        } else {
          await tx.gradeCategory.create({
            data: {
              courseId,
              termId,
              name: category.name,
              weight: category.weight,
            },
          });
        }
      }

      if (removed.length > 0) {
        await tx.gradeCategory.deleteMany({
          where: {
            id: { in: removed.map((category) => category.id) },
            courseId,
            termId,
          },
        });
      }
    });

    revalidatePath(`/course/${courseId}/grades`);
    revalidatePath(`/course/${courseId}/grades/settings`);
    revalidatePath(`/course/${courseId}/reports`);
  });
}

/**
 * Adds a sensible starting set of categories so a new class can grade on day
 * one. Refuses once any category exists, to avoid duplicating them.
 */
export async function seedDefaultCategoriesAction(
  courseId: string,
  termId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireActiveCourseManager(courseId);

    const existing = await prisma.gradeCategory.count({
      where: { courseId, termId },
    });
    if (existing > 0) {
      return { error: "This class already has categories" };
    }

    await prisma.gradeCategory.createMany({
      data: [
        { courseId, termId, name: "Coursework", weight: 40 },
        { courseId, termId, name: "Tests", weight: 40 },
        { courseId, termId, name: "Participation", weight: 20 },
      ],
    });

    revalidatePath(`/course/${courseId}/grades`);
    revalidatePath(`/course/${courseId}/grades/settings`);
  });
}

/** Exported for the settings page so the form can type its initial rows. */
export type CategoryInput = {
  id?: string;
  name: string;
  weight: number;
};
