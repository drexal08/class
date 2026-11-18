"use server";

import { revalidatePath } from "next/cache";

import {
  AuthError,
  requireActiveCourseManager,
  requireActiveCourseStudent,
  requireSubmissionManager,
  runAction,
} from "@/lib/auth/guards";
import { notifyCourse } from "@/lib/notify";
import { prisma } from "@/lib/prisma";
import { courseChannel, publish, userChannel } from "@/lib/realtime/server";
import { canSubmitWork, rubricScoreError } from "@/lib/rules";
import { materialiseAssignmentGrade } from "@/lib/school/assignment-grade";
import type { ActionState } from "@/lib/types";
import {
  firstIssue,
  gradeSubmissionSchema,
  submitWorkSchema,
} from "@/lib/validators";

/**
 * Makes sure a student has a submission row before they attach or type work.
 *
 * Attachments need a submission to belong to, and a draft row is also what
 * lets the grading view distinguish "started but not turned in" from "never
 * opened". Called from the assignment page; safe to call repeatedly.
 */
export async function ensureOwnSubmissionAction(
  courseId: string,
  assignmentId: string,
): Promise<void> {
  const context = await requireActiveCourseStudent(courseId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId, published: true },
    select: { id: true, type: true },
  });
  if (!assignment || assignment.type === "MATERIAL") return;

  await prisma.submission.upsert({
    where: {
      assignmentId_studentId: { assignmentId, studentId: context.user.id },
    },
    create: {
      assignmentId,
      studentId: context.user.id,
      status: "ASSIGNED",
    },
    update: {},
  });
}

/**
 * Lets a teacher record a grade for work that was never turned in.
 *
 * The grading view builds its roster from enrollments, so a student with no
 * submission row is visible but not gradeable. This creates the missing row on
 * demand — the equivalent of marking a blank paper — instead of hiding the
 * grade form.
 */
export async function ensureSubmissionForStudentAction(
  courseId: string,
  assignmentId: string,
  studentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireActiveCourseManager(courseId);

    const [assignment, enrollment] = await Promise.all([
      prisma.assignment.findFirst({
        where: { id: assignmentId, courseId },
        select: { id: true, type: true },
      }),
      prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: studentId, courseId } },
        select: { role: true },
      }),
    ]);

    if (!assignment || assignment.type === "MATERIAL") {
      throw new AuthError("That assignment no longer exists");
    }
    if (!enrollment || enrollment.role !== "STUDENT") {
      throw new AuthError("That student is not enrolled in this class");
    }

    await prisma.submission.upsert({
      where: { assignmentId_studentId: { assignmentId, studentId } },
      create: { assignmentId, studentId, status: "ASSIGNED" },
      update: {},
    });

    revalidatePath(`/course/${courseId}/classwork/${assignmentId}/grade`);
  });
}

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
    const context = await requireActiveCourseStudent(courseId);

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseId, published: true },
      select: {
        id: true,
        dueDate: true,
        type: true,
        title: true,
        acceptingSubmissions: true,
        allowLateSubmissions: true,
      },
    });
    if (!assignment) return { error: "That assignment no longer exists" };
    if (assignment.type === "MATERIAL") {
      return { error: "Material has nothing to turn in" };
    }
    if (!assignment.acceptingSubmissions) {
      return { error: "This assignment is not accepting submissions" };
    }

    const existing = await prisma.submission.findUnique({
      where: {
        assignmentId_studentId: { assignmentId, studentId: context.user.id },
      },
      select: {
        id: true,
        status: true,
        _count: { select: { attachments: true } },
      },
    });

    // Once marked, re-submitting would silently discard the grade.
    if (existing && !canSubmitWork(existing.status)) {
      return {
        error:
          "This work has already been marked, so it can no longer be turned in again.",
      };
    }

    if (!content && (existing?._count.attachments ?? 0) === 0) {
      return { error: "Add a response or attach a file before turning in" };
    }

    const now = new Date();
    // LATE is a state in its own right, not a flag alongside SUBMITTED.
    const late = Boolean(assignment.dueDate && now > assignment.dueDate);
    if (late && !assignment.allowLateSubmissions) {
      return { error: "This assignment does not accept late work" };
    }
    const status = late ? "LATE" : "SUBMITTED";

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

    const teachers = await prisma.enrollment.findMany({
      where: { courseId, role: "TEACHER" },
      select: { userId: true },
    });

    await notifyCourse({
      courseId,
      type: "WORK_SUBMITTED",
      title: `${context.user.displayName ?? context.user.email} turned in ${assignment.title}`,
      linkPath: `/course/${courseId}/classwork/${assignmentId}/grade`,
      actorId: context.user.id,
      recipientIds: teachers.map((teacher) => teacher.userId),
    });
  });
}

export async function unsubmitWorkAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireActiveCourseStudent(courseId);

    const assignment = await prisma.assignment.findFirst({
      where: { id: assignmentId, courseId },
      select: { acceptingSubmissions: true },
    });
    if (!assignment) return { error: "That assignment no longer exists" };
    // Withdrawing work from a closed assignment would strand the student
    // unable to turn it back in.
    if (!assignment.acceptingSubmissions) {
      return { error: "This assignment is closed for submissions" };
    }

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
    if (grade === undefined) {
      return { error: "Enter a grade before saving" };
    }

    const context = await requireSubmissionManager(submissionId);
    const maxPoints = context.submission.assignment.maxPoints;

    if (grade > maxPoints) {
      return { error: `Grade cannot be more than ${maxPoints} points` };
    }

    // Rubric marks arrive as parallel criterionId / points arrays.
    const criterionIds = formData.getAll("criterionId").map(String);
    const criterionPoints = formData.getAll("criterionPoints").map(String);

    const entries = criterionIds
      .map((criterionId, index) => {
        const raw = criterionPoints[index];
        if (!criterionId || raw === undefined || raw === "") return null;
        return { criterionId, points: Number(raw) };
      })
      .filter((entry): entry is { criterionId: string; points: number } =>
        entry !== null,
      );

    const rubricError = rubricScoreError(
      context.submission.assignment.rubric,
      entries,
    );
    if (rubricError) return { error: rubricError };

    await prisma.$transaction(async (tx) => {
      const gradedAt = new Date();

      await tx.submission.update({
        where: { id: submissionId },
        data: {
          grade,
          feedback: feedback ?? null,
          // Editing a returned grade keeps it returned; the student has
          // already seen this work come back.
          status:
            context.submission.status === "RETURNED" ? "RETURNED" : "GRADED",
          gradedAt,
        },
      });

      // Clearing a criterion in the form removes its old mark rather than
      // leaving a stale score behind.
      await tx.rubricScore.deleteMany({
        where: {
          submissionId,
          criterionId: { notIn: entries.map((entry) => entry.criterionId) },
        },
      });

      for (const entry of entries) {
        await tx.rubricScore.upsert({
          where: {
            submissionId_criterionId: {
              submissionId,
              criterionId: entry.criterionId,
            },
          },
          create: {
            submissionId,
            criterionId: entry.criterionId,
            points: entry.points,
          },
          update: { points: entry.points },
        });
      }

      // Feed the weighted gradebook from the same mark, so a graded piece of
      // coursework is not a second, parallel gradebook. This is a no-op when
      // the class has no active term or no "Coursework" category.
      await materialiseAssignmentGrade(tx, {
        courseId: context.courseId,
        assignmentId: context.submission.assignmentId,
        submissionId,
        studentId: context.submission.studentId,
        title: context.submission.assignment.title,
        maximum: context.submission.assignment.maxPoints,
        grade,
        gradedAt,
      });
    });

    revalidatePath(`/course/${context.courseId}/classwork`);
    revalidatePath(
      `/course/${context.courseId}/classwork/${context.submission.assignmentId}`,
    );
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
    const context = await requireSubmissionManager(submissionId);

    if (context.submission.status !== "GRADED") {
      return { error: "Only graded work can be returned" };
    }
    if (context.submission.grade === null) {
      return { error: "Save a grade before returning this work" };
    }

    await prisma.submission.update({
      where: { id: submissionId },
      data: { status: "RETURNED", returnedAt: new Date() },
    });

    revalidatePath(`/course/${context.courseId}/classwork`);
    revalidatePath(
      `/course/${context.courseId}/classwork/${context.submission.assignmentId}`,
    );
    revalidatePath(
      `/course/${context.courseId}/classwork/${context.submission.assignmentId}/grade`,
    );
    revalidatePath(`/course/${context.courseId}/grades`);

    // The student is told their work came back, on their own channel.
    await publish(userChannel(context.submission.studentId), "submission:graded", {
      actorId: context.user.id,
      id: context.submission.assignmentId,
    });

    await notifyCourse({
      courseId: context.courseId,
      type: "GRADE_RETURNED",
      title: `Work returned in ${context.courseName}`,
      body: `${context.submission.assignment.title} is ready to review`,
      linkPath: `/course/${context.courseId}/classwork/${context.submission.assignmentId}`,
      actorId: context.user.id,
      recipientIds: [context.submission.studentId],
    });
  });
}

/** Returns every graded submission for an assignment in one action. */
export async function returnAllAction(
  courseId: string,
  assignmentId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const context = await requireActiveCourseManager(courseId);

    const graded = await prisma.submission.findMany({
      where: { assignmentId, status: "GRADED", assignment: { courseId } },
      select: { id: true, studentId: true },
    });

    if (graded.length === 0) {
      throw new AuthError("There is nothing graded to return yet");
    }

    await prisma.submission.updateMany({
      where: { assignmentId, status: "GRADED", assignment: { courseId } },
      data: { status: "RETURNED", returnedAt: new Date() },
    });

    revalidatePath(`/course/${courseId}/classwork/${assignmentId}`);
    revalidatePath(`/course/${courseId}/classwork/${assignmentId}/grade`);
    revalidatePath(`/course/${courseId}/grades`);

    await Promise.all(
      graded.map((submission) =>
        publish(userChannel(submission.studentId), "submission:graded", {
          actorId: context.user.id,
          id: assignmentId,
        }),
      ),
    );

    await Promise.all(
      graded.map((submission) =>
        notifyCourse({
          courseId,
          type: "GRADE_RETURNED",
          title: `Work returned in ${context.courseName}`,
          linkPath: `/course/${courseId}/classwork/${assignmentId}`,
          actorId: context.user.id,
          recipientIds: [submission.studentId],
        }),
      ),
    );
  });
}
