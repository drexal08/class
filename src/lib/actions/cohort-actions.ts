"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { requireCohortManager, requireSchoolAdmin, requireSuperuser } from "@/lib/sdms/access";
import { generateJoinCode, generateCourseCode } from "@/lib/sdms/codes";
import type { ActionState } from "@/lib/types";
import type { Prisma } from "@/generated/prisma/client";

const memberActionSchema = z.object({
  cohortId: z.string().min(1),
  memberId: z.string().min(1),
  action: z.enum(["MOVE", "LEFT"]),
});

export async function updateMemberStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireCohortManager(formData.get("cohortId") as string);
    const parsed = memberActionSchema.safeParse({
      cohortId: formData.get("cohortId"),
      memberId: formData.get("memberId"),
      action: formData.get("action"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { cohortId, memberId, action } = parsed.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const member = await tx.cohortMember.findUnique({
        where: { id: memberId },
        select: { cohortId: true, userId: true, status: true },
      });
      if (!member || member.cohortId !== cohortId) {
        throw new Error("Member not found in this cohort");
      }

      const newStatus = action === "MOVE" ? "MOVED" : "LEFT";

      await tx.cohortMember.update({
        where: { id: memberId },
        data: { status: newStatus },
      });

      // Sync enrollments: deactivate all course enrollments for this student in this cohort's courses
      const cohortCourses = await tx.course.findMany({
        where: { cohortId },
        select: { id: true },
      });
      const courseIds = cohortCourses.map((c) => c.id);
      if (courseIds.length > 0) {
        await tx.enrollment.updateMany({
          where: {
            userId: member.userId,
            courseId: { in: courseIds },
            active: true,
          },
          data: { active: false, leftAt: new Date() },
        });
      }

      await tx.auditEvent.create({
        data: {
          schoolId: actor.cohort.schoolId,
          actorId: actor.user.id,
          action: `COHORT_MEMBER_${action}`,
          targetType: "CohortMember",
          targetId: memberId,
          metadata: { previousStatus: member.status, newStatus },
        },
      });
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

const disputeActionSchema = z.object({
  cohortId: z.string().min(1),
  disputeId: z.string().min(1),
  action: z.enum(["UNASSIGN", "REASSIGN"]),
  targetMemberId: z.string().optional(),
});

export async function resolveDisputeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(
      (await prisma.cohort.findUnique({
        where: { id: formData.get("cohortId") as string },
        select: { schoolId: true },
      }))?.schoolId ?? "",
    );
    const parsed = disputeActionSchema.safeParse({
      cohortId: formData.get("cohortId"),
      disputeId: formData.get("disputeId"),
      action: formData.get("action"),
      targetMemberId: formData.get("targetMemberId") ?? undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { cohortId, disputeId, action, targetMemberId } = parsed.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const dispute = await tx.claimDispute.findUnique({
        where: { id: disputeId },
        select: {
          id: true,
          memberId: true,
          code: true,
          resolvedAt: true,
          member: { select: { cohortId: true, userId: true } },
        },
      });
      if (!dispute || dispute.resolvedAt || dispute.member.cohortId !== cohortId) {
        throw new Error("Dispute not found or already resolved");
      }

      if (action === "UNASSIGN") {
        // Release the code from the current member, mark dispute resolved
        await tx.claimDispute.update({
          where: { id: disputeId },
          data: { resolvedAt: new Date(), resolvedById: actor.user.id },
        });
        await tx.cohortMember.update({
          where: { id: dispute.memberId },
          data: { claimedAt: null, claimedIpHash: null, mustChangePassword: true },
        });
        await tx.auditEvent.create({
          data: {
            schoolId: actor.school.id,
            actorId: actor.user.id,
            action: "CLAIM_DISPUTE_UNASSIGNED",
            targetType: "ClaimDispute",
            targetId: disputeId,
            metadata: { code: dispute.code },
          },
        });
      } else if (action === "REASSIGN") {
        if (!targetMemberId) throw new Error("Target member required for reassignment");
        const targetMember = await tx.cohortMember.findUnique({
          where: { id: targetMemberId },
          select: { cohortId: true, userId: true, status: true },
        });
        if (!targetMember || targetMember.cohortId !== cohortId || targetMember.status !== "ACTIVE") {
          throw new Error("Target member not found or not active in this cohort");
        }

        // Resolve old dispute and update old member
        await tx.claimDispute.update({
          where: { id: disputeId },
          data: { resolvedAt: new Date(), resolvedById: actor.user.id },
        });
        await tx.cohortMember.update({
          where: { id: dispute.memberId },
          data: { claimedAt: null, claimedIpHash: null, mustChangePassword: true },
        });

        // Create new dispute for target member (or just assign the code)
        await tx.claimDispute.create({
          data: {
            memberId: targetMemberId,
            code: dispute.code,
            note: `Reassigned by admin from dispute ${disputeId}`,
            resolvedAt: null,
          },
        });
        await tx.cohortMember.update({
          where: { id: targetMemberId },
          data: { claimedAt: new Date(), mustChangePassword: false },
        });

        await tx.auditEvent.create({
          data: {
            schoolId: actor.school.id,
            actorId: actor.user.id,
            action: "CLAIM_DISPUTE_REASSIGNED",
            targetType: "ClaimDispute",
            targetId: disputeId,
            metadata: { code: dispute.code, fromMemberId: dispute.memberId, toMemberId: targetMemberId },
          },
        });
      }
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

const combinationSchema = z.object({
  schoolId: z.string().min(1),
  name: z.string().trim().min(1, "Name is required").max(120),
  shortName: z.string().trim().min(1, "Short name is required").max(20),
  stream: z.string().trim().optional().nullable(),
  aliases: z.array(z.string().trim().min(1).max(120)).default([]),
});

export async function createCombinationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(formData.get("schoolId") as string);
    const parsed = combinationSchema.safeParse({
      schoolId: formData.get("schoolId"),
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      stream: formData.get("stream") || null,
      aliases: formData.getAll("aliases").map((a) => a.toString().trim()).filter(Boolean),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { schoolId, name, shortName, stream, aliases } = parsed.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const combination = await tx.combination.create({
        data: {
          schoolId,
          name,
          shortName,
          stream: stream ?? null,
          aliases: [],
        },
      });

      for (const alias of aliases) {
        const normalized = alias
          .normalize("NFKC")
          .toLocaleLowerCase("en")
          .replace(/&/g, " and ")
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
        if (!normalized) continue;
        await tx.combinationAlias.upsert({
          where: { schoolId_normalizedAlias: { schoolId, normalizedAlias: normalized } },
          create: {
            schoolId,
            combinationId: combination.id,
            alias,
            normalizedAlias: normalized,
          },
          update: { combinationId: combination.id },
        });
      }

      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.user.id,
          action: "COMBINATION_CREATED",
          targetType: "Combination",
          targetId: combination.id,
          metadata: { name, shortName, stream, aliasCount: aliases.length },
        },
      });
    });

    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath(`/admin/cohort/${formData.get("cohortId") as string}`);
  });
}

export async function updateCombinationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(formData.get("schoolId") as string);
    const parsed = combinationSchema.extend({ combinationId: z.string().min(1) }).safeParse({
      combinationId: formData.get("combinationId"),
      schoolId: formData.get("schoolId"),
      name: formData.get("name"),
      shortName: formData.get("shortName"),
      stream: formData.get("stream") || null,
      aliases: formData.getAll("aliases").map((a) => a.toString().trim()).filter(Boolean),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { combinationId, schoolId, name, shortName, stream, aliases } = parsed.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const existing = await tx.combination.findUnique({
        where: { id: combinationId },
        select: { schoolId: true, name: true },
      });
      if (!existing || existing.schoolId !== schoolId) {
        throw new Error("Combination not found");
      }

      await tx.combination.update({
        where: { id: combinationId },
        data: { name, shortName, stream: stream ?? null },
      });

      // Replace aliases: delete old, create new
      await tx.combinationAlias.deleteMany({ where: { combinationId } });
      for (const alias of aliases) {
        const normalized = alias
          .normalize("NFKC")
          .toLocaleLowerCase("en")
          .replace(/&/g, " and ")
          .replace(/[^\p{L}\p{N}]+/gu, " ")
          .trim();
        if (!normalized) continue;
        await tx.combinationAlias.upsert({
          where: { schoolId_normalizedAlias: { schoolId, normalizedAlias: normalized } },
          create: {
            schoolId,
            combinationId,
            alias,
            normalizedAlias: normalized,
          },
          update: { combinationId },
        });
      }

      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.user.id,
          action: "COMBINATION_UPDATED",
          targetType: "Combination",
          targetId: combinationId,
          metadata: { name, shortName, stream, aliasCount: aliases.length },
        },
      });
    });

    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath(`/admin/cohort/${formData.get("cohortId") as string}`);
  });
}

export async function deleteCombinationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(formData.get("schoolId") as string);
    const combinationId = formData.get("combinationId") as string;
    if (!combinationId) return { error: "Missing combinationId" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const combination = await tx.combination.findUnique({
        where: { id: combinationId },
        select: { schoolId: true, name: true, cohorts: { select: { id: true }, take: 1 } },
      });
      if (!combination || combination.schoolId !== (formData.get("schoolId") as string)) {
        throw new Error("Combination not found");
      }
      if (combination.cohorts.length > 0) {
        throw new Error("Cannot delete combination with existing cohorts");
      }

      await tx.combinationAlias.deleteMany({ where: { combinationId } });
      await tx.combination.delete({ where: { id: combinationId } });

      await tx.auditEvent.create({
        data: {
          schoolId: actor.school.id,
          actorId: actor.user.id,
          action: "COMBINATION_DELETED",
          targetType: "Combination",
          targetId: combinationId,
          metadata: { name: combination.name },
        },
      });
    });

    revalidatePath(`/admin?school=${formData.get("schoolId")}`);
  });
}

const rotateCodeSchema = z.object({
  cohortId: z.string().min(1),
  kind: z.enum(["COHORT", "COURSE"]),
  courseId: z.string().optional(),
});

export async function rotateJoinCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireCohortManager(formData.get("cohortId") as string);
    const parsed = rotateCodeSchema.safeParse({
      cohortId: formData.get("cohortId"),
      kind: formData.get("kind"),
      courseId: formData.get("courseId") ?? undefined,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { cohortId, kind, courseId } = parsed.data;

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (kind === "COHORT") {
        const oldCode = await tx.joinCode.findFirst({
          where: { cohortId, kind: "COHORT" },
          select: { code: true },
        });
        const newCode = generateJoinCode("COHORT");
        await tx.joinCode.updateMany({
          where: { cohortId, kind: "COHORT" },
          data: { code: newCode },
        });
        await tx.auditEvent.create({
          data: {
            schoolId: actor.cohort.schoolId,
            actorId: actor.user.id,
            action: "COHORT_JOIN_CODE_ROTATED",
            targetType: "JoinCode",
            targetId: cohortId,
            metadata: { oldCode: oldCode?.code, newCode },
          },
        });
      } else if (kind === "COURSE") {
        if (!courseId) throw new Error("courseId required for course code rotation");
        const course = await tx.course.findUnique({
          where: { id: courseId },
          select: { cohortId: true, code: true, kind: true },
        });
        if (!course || course.cohortId !== cohortId) {
          throw new Error("Course not found in this cohort");
        }
        const newCode = generateCourseCode(course.kind === "HOMEROOM" ? "HOMEROOM" : "SUBJECT");
        await tx.course.update({
          where: { id: courseId },
          data: { code: newCode },
        });
        await tx.joinCode.updateMany({
          where: { courseId, kind: "COURSE" },
          data: { code: newCode },
        });
        await tx.auditEvent.create({
          data: {
            schoolId: actor.cohort.schoolId,
            actorId: actor.user.id,
            action: "COURSE_JOIN_CODE_ROTATED",
            targetType: "JoinCode",
            targetId: courseId,
            metadata: { oldCode: course.code, newCode },
          },
        });
      }
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

export async function rotateSchoolCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    await requireSuperuser();
    const schoolId = formData.get("schoolId") as string;
    if (!schoolId) return { error: "Missing schoolId" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const oldCode = await tx.joinCode.findFirst({
        where: { schoolId, kind: "SCHOOL" },
        select: { code: true },
      });
      const newCode = generateJoinCode("SCHOOL");
      await tx.joinCode.updateMany({
        where: { schoolId, kind: "SCHOOL" },
        data: { code: newCode },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: (await requireSuperuser()).id,
          action: "SCHOOL_JOIN_CODE_ROTATED",
          targetType: "JoinCode",
          targetId: schoolId,
          metadata: { oldCode: oldCode?.code, newCode },
        },
      });
    });

    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath("/platform");
  });
}

/**
 * Wrapper for rotating cohort join code - can be called directly with simple params.
 */
export async function rotateCohortCodeAction(
  cohortId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireCohortManager(cohortId);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const oldCode = await tx.joinCode.findFirst({
        where: { cohortId, kind: "COHORT" },
        select: { code: true },
      });
      const newCode = generateJoinCode("COHORT");
      await tx.joinCode.updateMany({
        where: { cohortId, kind: "COHORT" },
        data: { code: newCode },
      });
      await tx.auditEvent.create({
        data: {
          schoolId: actor.cohort.schoolId,
          actorId: actor.user.id,
          action: "COHORT_JOIN_CODE_ROTATED",
          targetType: "JoinCode",
          targetId: cohortId,
          metadata: { oldCode: oldCode?.code, newCode },
        },
      });
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

/**
 * Wrapper for rotating course join code - can be called directly with simple params.
 */
export async function rotateCourseCodeAction(
  cohortId: string,
  courseId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireCohortManager(cohortId);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const course = await tx.course.findUnique({
        where: { id: courseId },
        select: { cohortId: true, code: true, kind: true },
      });
      if (!course || course.cohortId !== cohortId) {
        throw new Error("Course not found in this cohort");
      }
      const newCode = generateCourseCode(course.kind === "HOMEROOM" ? "HOMEROOM" : "SUBJECT");
      await tx.course.update({
        where: { id: courseId },
        data: { code: newCode },
      });
      await tx.joinCode.updateMany({
        where: { courseId, kind: "COURSE" },
        data: { code: newCode },
      });
      await tx.auditEvent.create({
        data: {
          schoolId: actor.cohort.schoolId,
          actorId: actor.user.id,
          action: "COURSE_JOIN_CODE_ROTATED",
          targetType: "JoinCode",
          targetId: courseId,
          metadata: { oldCode: course.code, newCode },
        },
      });
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

/**
 * Wrapper for rotating school join code - can be called directly with simple params.
 */
export async function rotateSchoolCodeActionSimple(
  schoolId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireSuperuser();

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const oldCode = await tx.joinCode.findFirst({
        where: { schoolId, kind: "SCHOOL" },
        select: { code: true },
      });
      const newCode = generateJoinCode("SCHOOL");
      await tx.joinCode.updateMany({
        where: { schoolId, kind: "SCHOOL" },
        data: { code: newCode },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: (await requireSuperuser()).id,
          action: "SCHOOL_JOIN_CODE_ROTATED",
          targetType: "JoinCode",
          targetId: schoolId,
          metadata: { oldCode: oldCode?.code, newCode },
        },
      });
    });

    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath("/platform");
  });
}

/**
 * Wrapper for resolving claim disputes - can be called directly with simple params.
 */
export async function resolveDisputeActionSimple(
  cohortId: string,
  disputeId: string,
  action: "UNASSIGN" | "REASSIGN",
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(
      (await prisma.cohort.findUnique({
        where: { id: cohortId },
        select: { schoolId: true },
      }))?.schoolId ?? "",
    );

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const dispute = await tx.claimDispute.findUnique({
        where: { id: disputeId },
        select: {
          id: true,
          memberId: true,
          code: true,
          resolvedAt: true,
          member: { select: { cohortId: true, userId: true } },
        },
      });
      if (!dispute || dispute.resolvedAt || dispute.member.cohortId !== cohortId) {
        throw new Error("Dispute not found or already resolved");
      }

      if (action === "UNASSIGN") {
        await tx.claimDispute.update({
          where: { id: disputeId },
          data: { resolvedAt: new Date(), resolvedById: actor.user.id },
        });
        await tx.cohortMember.update({
          where: { id: dispute.memberId },
          data: { claimedAt: null, claimedIpHash: null, mustChangePassword: true },
        });
        await tx.auditEvent.create({
          data: {
            schoolId: actor.school.id,
            actorId: actor.user.id,
            action: "CLAIM_DISPUTE_RESOLVED",
            targetType: "ClaimDispute",
            targetId: disputeId,
            metadata: { resolution: "UNASSIGN", code: dispute.code },
          },
        });
      } else if (action === "REASSIGN") {
        // For REASSIGN, we just mark as resolved - the admin will manually reassign
        await tx.claimDispute.update({
          where: { id: disputeId },
          data: { resolvedAt: new Date(), resolvedById: actor.user.id },
        });
        await tx.auditEvent.create({
          data: {
            schoolId: actor.school.id,
            actorId: actor.user.id,
            action: "CLAIM_DISPUTE_RESOLVED",
            targetType: "ClaimDispute",
            targetId: disputeId,
            metadata: { resolution: "REASSIGN", code: dispute.code },
          },
        });
      }
    });

    revalidatePath(`/admin/cohort/${cohortId}`);
  });
}

