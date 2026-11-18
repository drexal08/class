import type { Prisma } from "@/generated/prisma/client";

/**
 * Keeps the weighted gradebook in step with coursework that has been graded.
 *
 * A graded `Submission` becomes one `GradeItem` (linked by `assignmentId`) plus
 * one `GradeScore` for the student. Re-grading updates the same item instead of
 * adding a second column, and deleting the assignment later leaves the item in
 * place with `assignmentId` nulled — history is not erased by cleanup.
 *
 * Returns `null` when the class has no active term or no "Coursework" category,
 * because silently inventing a category would change the teacher's weights.
 * The manual gradebook still works in that case; this bridge is additive.
 */
export async function materialiseAssignmentGrade(
  tx: Prisma.TransactionClient,
  input: {
    courseId: string;
    assignmentId: string;
    submissionId: string;
    studentId: string;
    title: string;
    maximum: number;
    grade: number;
    gradedAt: Date;
  },
): Promise<{ gradeItemId: string } | null> {
  if (!Number.isFinite(input.maximum) || input.maximum <= 0) return null;

  const term =
    (await tx.term.findFirst({
      where: { isActive: true },
      select: { id: true },
    })) ??
    (await tx.term.findFirst({
      orderBy: { startsOn: "desc" },
      select: { id: true },
    }));

  if (!term) return null;

  const category = await tx.gradeCategory.findFirst({
    where: {
      courseId: input.courseId,
      termId: term.id,
      name: { equals: "Coursework", mode: "insensitive" },
    },
    select: { id: true },
  });

  if (!category) return null;

  // Date-only, so every re-grade on the same day keeps the same assessed date
  // and the unique title/date key stays stable.
  const assessedOn = new Date(
    Date.UTC(
      input.gradedAt.getUTCFullYear(),
      input.gradedAt.getUTCMonth(),
      input.gradedAt.getUTCDate(),
    ),
  );

  const item = await tx.gradeItem.upsert({
    where: { assignmentId: input.assignmentId },
    create: {
      courseId: input.courseId,
      termId: term.id,
      categoryId: category.id,
      title: input.title,
      maximum: input.maximum,
      assessedOn,
      assignmentId: input.assignmentId,
    },
    update: {
      categoryId: category.id,
      title: input.title,
      maximum: input.maximum,
    },
    select: { id: true },
  });

  await tx.gradeScore.upsert({
    where: {
      gradeItemId_studentId: {
        gradeItemId: item.id,
        studentId: input.studentId,
      },
    },
    create: {
      gradeItemId: item.id,
      studentId: input.studentId,
      score: input.grade,
    },
    update: { score: input.grade },
  });

  return { gradeItemId: item.id };
}
