"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import {
  AuthError,
  requireActiveCourseManager,
  requireActiveCourseStudent,
  runAction,
} from "@/lib/auth/guards";
import { notifyCourse } from "@/lib/notify";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import {
  absenceRequestSchema,
  attendanceDecisionSchema,
  attendanceRecordInputSchema,
  saveAttendanceSchema,
} from "@/lib/school/validation";

/**
 * Attendance mutations.
 *
 * The register is the source of truth: approving an absence request never
 * writes attendance records, it only resolves the request. A teacher who wants
 * the day excused marks it in the register themselves.
 */

export async function saveAttendanceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const studentIds = formData.getAll("studentId").map(String);
    const statuses = formData.getAll("status").map(String);
    const notes = formData.getAll("note").map(String);
    const minutesLate = formData.getAll("minutesLate").map(String);

    const rows = studentIds
      .map((studentId, index) => ({
        studentId,
        status: statuses[index] ?? "",
        note: notes[index] ?? "",
        minutesLate: minutesLate[index] ?? "",
      }))
      .filter((row) => row.studentId.length > 0 && row.status.length > 0);

    const parsed = saveAttendanceSchema.safeParse({
      courseId: formData.get("courseId"),
      date: formData.get("date"),
      period: formData.get("period"),
      topic: formData.get("topic"),
      records: rows,
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, date, period, topic, records } = parsed.data;
    const context = await requireActiveCourseManager(courseId);

    // Re-validating every roster row against the enrollment table stops a
    // crafted request from writing a record for a student in another class.
    const enrollments = await prisma.enrollment.findMany({
      where: { courseId, role: "STUDENT" },
      select: { userId: true },
    });
    const enrolled = new Set(enrollments.map((entry) => entry.userId));
    const outsider = records.find((record) => !enrolled.has(record.studentId));
    if (outsider) {
      return { error: "One of those students is not enrolled in this class" };
    }

    if (new Set(records.map((record) => record.studentId)).size !== records.length) {
      return { error: "A student appears twice on this register" };
    }

    // `upsert` cannot key on a compound unique that contains a nullable column,
    // so a session with no period is located with findFirst.
    const existing = await prisma.attendanceSession.findFirst({
      where: { courseId, date, period: period ?? null },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      const sessionId = existing
        ? (
            await tx.attendanceSession.update({
              where: { id: existing.id },
              data: {
                topic: topic ?? null,
                markedById: context.user.id,
                markedAt: new Date(),
              },
              select: { id: true },
            })
          ).id
        : (
            await tx.attendanceSession.create({
              data: {
                courseId,
                date,
                period: period ?? null,
                topic: topic ?? null,
                markedById: context.user.id,
              },
              select: { id: true },
            })
          ).id;

      for (const record of records) {
        await tx.attendanceRecord.upsert({
          where: {
            sessionId_studentId: {
              sessionId,
              studentId: record.studentId,
            },
          },
          create: {
            sessionId,
            studentId: record.studentId,
            status: record.status,
            note: record.note ?? null,
            minutesLate: record.status === "LATE" ? (record.minutesLate ?? null) : null,
          },
          update: {
            status: record.status,
            note: record.note ?? null,
            minutesLate: record.status === "LATE" ? (record.minutesLate ?? null) : null,
          },
        });
      }

      // Anyone removed from the roster since the register was opened should not
      // keep a stale record on this session.
      await tx.attendanceRecord.deleteMany({
        where: {
          sessionId,
          studentId: { notIn: records.map((record) => record.studentId) },
        },
      });
    });

    revalidatePath(`/course/${courseId}/attendance`);
    revalidatePath(`/course/${courseId}/reports`);
    revalidatePath("/attendance");
  });
}

export async function createAbsenceRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = absenceRequestSchema.safeParse({
      courseId: formData.get("courseId"),
      fromDate: formData.get("fromDate"),
      toDate: formData.get("toDate"),
      reason: formData.get("reason"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, fromDate, toDate, reason } = parsed.data;
    const context = await requireActiveCourseStudent(courseId);

    // Two overlapping requests would make the teacher's inbox ambiguous.
    const overlapping = await prisma.attendanceRequest.findFirst({
      where: {
        courseId,
        studentId: context.user.id,
        status: "PENDING",
        fromDate: { lte: toDate },
        toDate: { gte: fromDate },
      },
      select: { id: true },
    });
    if (overlapping) {
      return { error: "You already have a pending request covering those days" };
    }

    await prisma.attendanceRequest.create({
      data: {
        courseId,
        studentId: context.user.id,
        fromDate,
        toDate,
        reason,
      },
    });

    // The teachers who can answer it hear about it; students are not told,
    // because a request is not yet a decision.
    const teachers = await prisma.enrollment.findMany({
      where: { courseId, role: "TEACHER" },
      select: { userId: true },
    });

    await notifyCourse({
      courseId,
      type: "ABSENCE_REQUESTED",
      title: `${context.user.displayName ?? context.user.email} requested an absence`,
      body: reason,
      linkPath: `/course/${courseId}/attendance`,
      actorId: context.user.id,
      recipientIds: teachers.map((teacher) => teacher.userId),
    });

    revalidatePath("/attendance");
    revalidatePath(`/course/${courseId}/attendance`);
  });
}

export async function cancelAbsenceRequestAction(
  requestId: string,
): Promise<ActionState> {
  return runAction(async () => {
    // The request is resolved first, then its course is used for the guard, so
    // the student never has to pass a course id from the browser.
    const request = await prisma.attendanceRequest.findUnique({
      where: { id: requestId },
      select: { id: true, courseId: true, studentId: true, status: true },
    });
    if (!request || request.status !== "PENDING") {
      throw new AuthError("That request can no longer be cancelled");
    }

    const context = await requireActiveCourseStudent(request.courseId);
    if (request.studentId !== context.user.id) {
      throw new AuthError("That request belongs to someone else");
    }

    await prisma.attendanceRequest.delete({ where: { id: request.id } });
    revalidatePath("/attendance");
    revalidatePath(`/course/${request.courseId}/attendance`);
  });
}

export async function decideAbsenceRequestAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = attendanceDecisionSchema.safeParse({
      courseId: formData.get("courseId"),
      requestId: formData.get("requestId"),
      status: formData.get("status"),
      note: formData.get("note"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, requestId, status, note } = parsed.data;
    const context = await requireActiveCourseManager(courseId);

    // The student is read from the request before it is resolved, so the
    // decision can be reported to the right person.
    const request = await prisma.attendanceRequest.findFirst({
      where: { id: requestId, courseId },
      select: { id: true, studentId: true },
    });
    if (!request) return { error: "That request no longer exists" };

    const { count } = await prisma.attendanceRequest.updateMany({
      where: { id: requestId, courseId },
      data: {
        status,
        decidedById: context.user.id,
        decidedAt: new Date(),
        decisionNote: note ?? null,
      },
    });
    if (count === 0) return { error: "That request no longer exists" };

    await notifyCourse({
      courseId,
      type: "ABSENCE_DECIDED",
      title:
        status === "APPROVED"
          ? "Your absence request was approved"
          : "Your absence request was declined",
      body: note ?? undefined,
      linkPath: "/attendance",
      actorId: context.user.id,
      recipientIds: [request.studentId],
    });

    revalidatePath(`/course/${courseId}/attendance`);
    revalidatePath("/attendance");
  });
}
