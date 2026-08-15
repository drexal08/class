"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  requireCourseStudent,
  requireSubmissionTeacher,
  runAction,
} from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish, userChannel } from "@/lib/realtime/server";
import type { ActionState } from "@/lib/types";
import {
  firstIssue,
  gradeSubmissionSchema,
  submitWorkSchema,
} from "@/lib/validators";

export async function submitWorkAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const courseId = String(formData.get("courseId") ?? "");
    const parsed = submitWorkSchema.safeParse({
      assignmentId: formData.get("assignmentId"),
      content: formData.get("content"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { assignmentId, content } = parsed.data;
    const context = await requireCourseStudent(courseId);

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseId, published: true },
      select: { id: true, dueDate: true, type: true },
    });
    if (!assignment) return { error: "That assignment no longer exists" };
    if (assignment.type === "MATERIAL") {
      return { error: "Material has nothing to turn in" };
    }

    const now = new Date();
    // LATE is a state in its own right, not a flag alongside SUBMITTED.
    const status =
      assignment.dueDate && now > assignment.dueDate ? "LATE" : "SUBMITTED";

    // Upsert on the (assignmentId, studentId) unique key — the previous
    // select-then-insert could double-write under a double click.
    await prisma.submission.upsert({
      where: {
        assignmentId_studentId: { assignmentId, studentId: context.user.id },
      },
      create: {
        assignmentId,
        studentId: context.user.id,
        content: content ?? null,
        status,
        submittedAt: now,
      },
      update: {
        content: content ?? null,
        status,
        submittedAt: now,
      },
    });

    revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
    revalidatePath(`/course/${courseId}/classwork`);

    await publish(courseChannel(courseId), "submission:new", {
      actorId: context.user.id,
      id: assignmentId,
    });
  });
}

export async function unsubmitWorkAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireCourseStudent(courseId);

    // Refuses once a teacher has graded or returned the work.
    const { count } = await prisma.submission.updateMany({
      where: {
        assignmentId,
        studentId: context.user.id,
        status: { in: ["SUBMITTED", "LATE"] },
        assignment: { courseId },
      },
      data: { status: "ASSIGNED", submittedAt: null },
    });

    if (count === 0) {
      return { error: "This work can no longer be unsubmitted" };
    }

    revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
    revalidatePath(`/course/${courseId}/classwork`);
  });
}

export async function gradeSubmissionAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = gradeSubmissionSchema.safeParse({
      submissionId: formData.get("submissionId"),
      grade: formData.get("grade"),
      feedback: formData.get("feedback"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { submissionId, grade, feedback } = parsed.data;
    const context = await requireSubmissionTeacher(submissionId);
    const maxPoints = context.submission.assignment.maxPoints;

    if (grade !== undefined && grade > maxPoints) {
      return { error: `Grade cannot be more than ${maxPoints} points` };
    }

    // Rubric marks arrive as parallel criterionId / points arrays.
    const criterionIds = formData.getAll("criterionId").map(String);
    const criterionPoints = formData.getAll("criterionPoints").map(String);

    await prisma.$transaction(async (tx) => {
      await tx.submission.update({
        where: { id: submissionId },
        data: {
          grade: grade ?? null,
          feedback: feedback ?? null,
          status: "GRADED",
          gradedAt: new Date(),
        },
      });

      for (let index = 0; index < criterionIds.length; index += 1) {
        const criterionId = criterionIds[index];
        const raw = criterionPoints[index];
        if (!criterionId || raw === undefined || raw === "") continue;

        const points = Number(raw);
        if (Number.isNaN(points)) continue;

        await tx.rubricScore.upsert({
          where: { submissionId_criterionId: { submissionId, criterionId } },
          create: { submissionId, criterionId, points },
          update: { points },
        });
      }
    });

    revalidatePath(`/course/${context.courseId}/classwork`);
    revalidatePath(
      `/course/${context.courseId}/classwork/${context.submission.assignmentId}/grade`,
    );
    revalidatePath(`/course/${context.courseId}/grades`);
  });
}

export async function returnSubmissionAction(
  submissionId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireSubmissionTeacher(submissionId);

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "RETURNED", returnedAt: new Date() },
    });

    revalidatePath(`/course/${context.courseId}/classwork`);
    revalidatePath(
      `/course/${context.courseId}/classwork/${context.submission.assignmentId}/grade`,
    );
    revalidatePath(`/course/${context.courseId}/grades`);

    // The student is told their work came back, on their own channel.
    await publish(userChannel(context.submission.studentId), "submission:graded", {
      actorId: context.user.id,
      id: context.submission.assignmentId,
    });
  });
}

/** Returns every graded submission for an assignment in one action. */
export async function returnAllAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const graded = await prisma.submission.findMany({
      where: { assignmentId, status: "GRADED", assignment: { courseId } },
      select: { id: true },
    });

    if (graded.length === 0) {
      throw new AuthError("There is nothing graded to return yet");
    }

    // Authorised once, through the same guard the single-return path uses.
    await requireSubmissionTeacher(graded[0].id);

    await prisma.submission.updateMany({
      where: { assignmentId, status: "GRADED", assignment: { courseId } },
      data: { status: "RETURNED", returnedAt: new Date() },
    });

    revalidatePath(`/course/${courseId}/classwork/${assignmentId}/grade`);
    revalidatePath(`/course/${courseId}/grades`);
  });
}
