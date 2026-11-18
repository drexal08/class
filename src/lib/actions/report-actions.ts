"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { AuthError, requireActiveCourseManager, runAction } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import { reportCommentSchema } from "@/lib/school/validation";

/**
 * Saves or clears the teacher's written comment on a student's term report.
 * An empty body deletes the row, so "cleared" and "never written" are the same
 * state and the report card can simply omit the block.
 */
export async function saveReportCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = reportCommentSchema.safeParse({
      courseId: formData.get("courseId"),
      termId: formData.get("termId"),
      studentId: formData.get("studentId"),
      body: formData.get("body"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, termId, studentId, body } = parsed.data;
    const context = await requireActiveCourseManager(courseId);

    const [term, enrollment] = await Promise.all([
      prisma.term.findUnique({ where: { id: termId }, select: { id: true } }),
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: studentId, courseId } },
        select: { role: true },
      }),
    ]);

    if (!term) throw new AuthError("That term no longer exists");
    if (!enrollment || enrollment.role !== "STUDENT") {
      throw new AuthError("That student is not enrolled in this class");
    }

    if (body.length === 0) {
      await prisma.reportComment.deleteMany({
        where: { courseId, termId, studentId },
      });
    } else {
      await prisma.reportComment.upsert({
        where: {
          courseId_termId_studentId: { courseId, termId, studentId },
        },
        create: {
          courseId,
          termId,
          studentId,
          authorId: context.user.id,
          body,
        },
        update: { body, authorId: context.user.id },
      });
    }

    revalidatePath(`/course/${courseId}/reports`);
    revalidatePath(`/reports/${termId}`);
  });
}
