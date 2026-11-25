"use server";

import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";

import { AuthError, requireUser, runAction } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, requireSuperuser } from "@/lib/sdms/access";
import { generateJoinCode, normalizeJoinCode } from "@/lib/sdms/codes";
import type { ActionState } from "@/lib/types";
import { emailSchema, firstIssue } from "@/lib/validators";

const schoolNameSchema = z.string().trim().min(2, "Enter the school name").max(120);
const createSchoolSchema = z.object({
  name: schoolNameSchema,
  adminEmail: z.union([z.literal(""), emailSchema]).optional(),
});

function slugForSchool(name: string): string {
  const base = name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "school";
  return `${base}-${randomInt(0x100000, 0xffffff).toString(36)}`;
}

export async function createSchoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSuperuser();
    const parsed = createSchoolSchema.safeParse({
      name: formData.get("name"),
      adminEmail: formData.get("adminEmail") ?? "",
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const admin = parsed.data.adminEmail
      ? await prisma.user.findFirst({
          where: { email: { equals: parsed.data.adminEmail, mode: "insensitive" } },
          select: { id: true, role: true },
        })
      : null;
    if (parsed.data.adminEmail && !admin) {
      return { error: "The school admin must have an LMS account first" };
    }
    if (admin?.role === "STUDENT") {
      return { error: "A school admin must have a teacher account" };
    }

    for (let attempt = 0; attempt < 6; attempt += 1) {
      try {
        await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
          const school = await tx.school.create({
            data: {
              name: parsed.data.name,
              slug: slugForSchool(parsed.data.name),
              createdById: actor.id,
            },
            select: { id: true },
          });
          await tx.joinCode.create({
            data: { code: generateJoinCode("SCHOOL"), kind: "SCHOOL", schoolId: school.id },
          });
          if (admin) {
            await tx.schoolMember.create({
              data: {
                schoolId: school.id,
                userId: admin.id,
                role: "ADMIN",
                status: "ACTIVE",
                decidedById: actor.id,
                decidedAt: new Date(),
              },
            });
          }
          await tx.auditEvent.create({
            data: {
              schoolId: school.id,
              actorId: actor.id,
              action: "SCHOOL_CREATED",
              targetType: "School",
              targetId: school.id,
              metadata: { hasAdmin: Boolean(admin) },
            },
          });
        });
        revalidatePath("/platform");
        return;
      } catch (error) {
        if ((error as { code?: string }).code === "P2002") continue;
        throw error;
      }
    }
    throw new Error("Could not allocate unique school identifiers");
  });
}

export async function appointSchoolAdminAction(
  schoolId: string,
  email: string,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSuperuser();
    const parsedEmail = emailSchema.safeParse(email);
    if (!parsedEmail.success) return { error: firstIssue(parsedEmail.error) };
    const target = await prisma.user.findFirst({
      where: { email: { equals: parsedEmail.data, mode: "insensitive" } },
      select: { id: true, role: true },
    });
    if (!target) return { error: "That person does not have an LMS account" };
    if (target.role === "STUDENT") return { error: "A school admin must have a teacher account" };

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      await tx.schoolMember.upsert({
        where: { schoolId_userId: { schoolId, userId: target.id } },
        create: {
          schoolId,
          userId: target.id,
          role: "ADMIN",
          status: "ACTIVE",
          decidedById: actor.id,
          decidedAt: new Date(),
        },
        update: {
          role: "ADMIN",
          status: "ACTIVE",
          decidedById: actor.id,
          decidedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.id,
          action: "SCHOOL_ADMIN_APPOINTED",
          targetType: "User",
          targetId: target.id,
        },
      });
    });
    revalidatePath("/platform");
  });
}

export async function setSchoolDisabledAction(
  schoolId: string,
  disabled: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSuperuser();
    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      await tx.school.update({
        where: { id: schoolId },
        data: { disabledAt: disabled ? new Date() : null },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.id,
          action: disabled ? "SCHOOL_DISABLED" : "SCHOOL_ENABLED",
          targetType: "School",
          targetId: schoolId,
        },
      });
    });
    revalidatePath("/platform");
  });
}

export async function joinSchoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "STUDENT") throw new AuthError("Students join their cohort, not a school staff team");
    const code = normalizeJoinCode(formData.get("code"));
    const joinCode = await prisma.joinCode.findFirst({
      where: {
        code,
        kind: "SCHOOL",
        school: { disabledAt: null, requiresApproval: true },
      },
      select: { schoolId: true },
    });
    if (!joinCode?.schoolId) return { error: "No school found with that code" };

    await prisma.schoolMember.upsert({
      where: { schoolId_userId: { schoolId: joinCode.schoolId, userId: user.id } },
      create: { schoolId: joinCode.schoolId, userId: user.id, status: "PENDING" },
      update: {
        status: "PENDING",
        role: "TEACHER",
        requestedAt: new Date(),
        decidedAt: null,
        decidedById: null,
      },
    });
    revalidatePath(`/admin?school=${joinCode.schoolId}`);
    return { success: true };
  });
}

export async function reviewTeacherJoinAction(
  schoolId: string,
  memberId: string,
  decision: "ACTIVE" | "REJECTED",
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(schoolId);
    const member = await prisma.schoolMember.findFirst({
      where: { id: memberId, schoolId },
      select: { id: true, userId: true },
    });
    if (!member) return { error: "That join request no longer exists" };

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      await tx.schoolMember.update({
        where: { id: member.id },
        data: { status: decision, decidedById: actor.user.id, decidedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.user.id,
          action: decision === "ACTIVE" ? "TEACHER_APPROVED" : "TEACHER_REJECTED",
          targetType: "SchoolMember",
          targetId: member.id,
        },
      });
    });
    revalidatePath(`/admin?school=${schoolId}`);
  });
}

export async function promoteSchoolTeacherAction(
  schoolId: string,
  memberId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(schoolId);
    const updated = await prisma.schoolMember.updateMany({
      where: { id: memberId, schoolId, status: "ACTIVE" },
      data: { role: "ADMIN", decidedById: actor.user.id, decidedAt: new Date() },
    });
    if (updated.count === 0) return { error: "That teacher is not active in this school" };
    await prisma.auditEvent.create({
      data: {
        schoolId,
        actorId: actor.user.id,
        action: "SCHOOL_ADMIN_PROMOTED",
        targetType: "SchoolMember",
        targetId: memberId,
      },
    });
    revalidatePath(`/admin?school=${schoolId}`);
  });
}

const updateSchoolSettingsSchema = z.object({
  name: z.string().trim().min(2, "Enter the school name").max(120),
  requiresApproval: z.boolean(),
});

export async function updateSchoolSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(formData.get("schoolId") as string);
    const schoolId = formData.get("schoolId") as string;

    const parsed = updateSchoolSettingsSchema.safeParse({
      name: formData.get("name"),
      requiresApproval: formData.get("requiresApproval") === "true",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.school.update({
        where: { id: schoolId },
        data: {
          name: parsed.data.name,
          requiresApproval: parsed.data.requiresApproval,
        },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.user.id,
          action: "SCHOOL_SETTINGS_UPDATED",
          targetType: "School",
          targetId: schoolId,
          metadata: { name: parsed.data.name, requiresApproval: parsed.data.requiresApproval },
        },
      });
    });
    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath("/platform");
  });
}

/**
 * Wrapper for updating school settings - can be called directly with simple params.
 */
export async function updateSchoolSettingsActionSimple(
  schoolId: string,
  name: string,
  requiresApproval: boolean,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSchoolAdmin(schoolId);

    const parsed = updateSchoolSettingsSchema.safeParse({
      name,
      requiresApproval,
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input" };

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.school.update({
        where: { id: schoolId },
        data: {
          name: parsed.data.name,
          requiresApproval: parsed.data.requiresApproval,
        },
      });
      await tx.auditEvent.create({
        data: {
          schoolId,
          actorId: actor.user.id,
          action: "SCHOOL_SETTINGS_UPDATED",
          targetType: "School",
          targetId: schoolId,
          metadata: { name: parsed.data.name, requiresApproval: parsed.data.requiresApproval },
        },
      });
    });
    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath("/platform");
  });
}
