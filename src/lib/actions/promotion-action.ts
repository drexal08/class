"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { runAction } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { requireCohortManager } from "@/lib/sdms/access";
import { generateJoinCode, generateCourseCode } from "@/lib/sdms/codes";
import type { ActionState } from "@/lib/types";

const promoteCohortSchema = z.object({
  sourceCohortId: z.string().min(1),
  destinationLabel: z.string().trim().min(1, "Destination cohort label is required").max(120),
  destinationGrade: z.string().trim().min(1, "Grade is required").max(20),
  destinationAcademicYear: z.coerce.number().int().min(2000).max(2100),
  destinationCombinationId: z.string().min(1),
  retainHomeroomTeacher: z.coerce.boolean().default(false),
});

export async function promoteCohortAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireCohortManager(formData.get("sourceCohortId") as string);

    const parsed = promoteCohortSchema.safeParse({
      sourceCohortId: formData.get("sourceCohortId"),
      destinationLabel: formData.get("destinationLabel"),
      destinationGrade: formData.get("destinationGrade"),
      destinationAcademicYear: formData.get("destinationAcademicYear"),
      destinationCombinationId: formData.get("destinationCombinationId"),
      retainHomeroomTeacher: formData.get("retainHomeroomTeacher") === "true",
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const {
      sourceCohortId,
      destinationLabel,
      destinationGrade,
      destinationAcademicYear,
      destinationCombinationId,
      retainHomeroomTeacher,
    } = parsed.data;

    const sourceCohort = await prisma.cohort.findUnique({
      where: { id: sourceCohortId },
      select: {
        id: true,
        schoolId: true,
        label: true,
        grade: true,
        academicYear: true,
        combinationId: true,
        ownerId: true,
        passwordPolicy: true,
        passwordSeedYear: true,
        homeroomCourseId: true,
      },
    });
    if (!sourceCohort) return { error: "Source cohort not found" };
    if (sourceCohort.schoolId !== actor.cohort.schoolId) return { error: "Cohort not in your school" };

    // Check if destination cohort already exists (idempotency)
    let destCohort = await prisma.cohort.findUnique({
      where: {
        schoolId_label_academicYear: {
          schoolId: sourceCohort.schoolId,
          label: destinationLabel,
          academicYear: destinationAcademicYear,
        },
      },
      select: {
        id: true,
        label: true,
        homeroomCourseId: true,
      },
    });

    const homeroomTeacherId = retainHomeroomTeacher && sourceCohort.homeroomCourseId
      ? await prisma.course.findUnique({ where: { id: sourceCohort.homeroomCourseId }, select: { teacherId: true } })
        .then((c: { teacherId: string } | null) => c?.teacherId ?? null)
      : null;

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      // Create or reuse destination cohort
      if (!destCohort) {
        // Create cohort join code
        const cohortJoinCode = generateJoinCode("COHORT");
        const courseJoinCode = generateCourseCode("HOMEROOM");

        const newCohort = await tx.cohort.create({
          data: {
            schoolId: sourceCohort.schoolId,
            combinationId: destinationCombinationId,
            label: destinationLabel,
            grade: destinationGrade,
            academicYear: destinationAcademicYear,
            passwordSeedYear: destinationAcademicYear,
            passwordPolicy: "DEFAULT",
            passwordSetAt: new Date(),
            createdById: actor.user.id,
            ownerId: actor.user.id,
          },
          select: { id: true },
        });

        // Create homeroom course for destination cohort
        const homeroom = await tx.course.create({
          data: {
            cohortId: newCohort.id,
            schoolId: sourceCohort.schoolId,
            kind: "HOMEROOM",
            name: destinationLabel,
            code: courseJoinCode,
            teacherId: homeroomTeacherId ?? actor.user.id,
            subject: undefined,
          },
          select: { id: true },
        });

        // Create join codes
        await tx.joinCode.create({
          data: { code: cohortJoinCode, kind: "COHORT", schoolId: sourceCohort.schoolId, cohortId: newCohort.id },
        });
        await tx.joinCode.create({
          data: { code: courseJoinCode, kind: "COURSE", schoolId: sourceCohort.schoolId, courseId: homeroom.id },
        });

        // Link homeroom to cohort
        await tx.cohort.update({
          where: { id: newCohort.id },
          data: { homeroomCourseId: homeroom.id },
        });

        destCohort = { id: newCohort.id, label: destinationLabel, homeroomCourseId: homeroom.id };
      } else {
        // Ensure homeroom exists
        if (!destCohort.homeroomCourseId) {
          const courseJoinCode = generateCourseCode("HOMEROOM");
          const homeroom = await tx.course.create({
            data: {
              cohortId: destCohort.id,
              schoolId: sourceCohort.schoolId,
              kind: "HOMEROOM",
              name: destinationLabel,
              code: courseJoinCode,
              teacherId: homeroomTeacherId ?? actor.user.id,
              subject: undefined,
            },
            select: { id: true },
          });
          await tx.joinCode.create({
            data: { code: courseJoinCode, kind: "COURSE", schoolId: sourceCohort.schoolId, courseId: homeroom.id },
          });
          await tx.cohort.update({
            where: { id: destCohort.id },
            data: { homeroomCourseId: homeroom.id },
          });
          destCohort = { ...destCohort, homeroomCourseId: homeroom.id };
        }
      }

      // Copy active memberships idempotently
      const activeMembers = await tx.cohortMember.findMany({
        where: { cohortId: sourceCohortId, status: "ACTIVE" },
        select: { userId: true, status: true, claimedAt: true, mustChangePassword: true, lastSignInAt: true },
      });

      for (const member of activeMembers) {
        const existing = await tx.cohortMember.findUnique({
          where: { cohortId_userId: { cohortId: destCohort!.id, userId: member.userId } },
        });

        if (existing) {
          if (existing.status !== "ACTIVE") {
            await tx.cohortMember.update({
              where: { id: existing.id },
              data: { status: "ACTIVE", mustChangePassword: member.mustChangePassword },
            });
          }
        } else {
          await tx.cohortMember.create({
            data: {
              cohortId: destCohort!.id,
              userId: member.userId,
              status: "ACTIVE",
              mustChangePassword: member.mustChangePassword,
              claimedAt: member.claimedAt,
              lastSignInAt: member.lastSignInAt,
            },
          });
        }
      }

      // Mark source cohort members as MOVED (preserve history)
      await tx.cohortMember.updateMany({
        where: { cohortId: sourceCohortId, status: "ACTIVE" },
        data: { status: "MOVED" },
      });

      // Sync enrollments: create homeroom enrollments in destination
      const destActiveMembers = await tx.cohortMember.findMany({
        where: { cohortId: destCohort!.id, status: "ACTIVE" },
        select: { userId: true },
      });

      if (destCohort!.homeroomCourseId) {
        for (const m of destActiveMembers) {
          await tx.enrollment.upsert({
            where: { userId_courseId: { userId: m.userId, courseId: destCohort!.homeroomCourseId! } },
            create: { userId: m.userId, courseId: destCohort!.homeroomCourseId!, role: "STUDENT", active: true },
            update: { active: true },
          });
        }

        // Teacher enrollment for homeroom
        const teacherId = homeroomTeacherId ?? actor.user.id;
        await tx.enrollment.upsert({
          where: { userId_courseId: { userId: teacherId, courseId: destCohort!.homeroomCourseId! } },
          create: { userId: teacherId, courseId: destCohort!.homeroomCourseId!, role: "TEACHER", active: true },
          update: { active: true, role: "TEACHER" },
        });
      }

      // Audit
      await tx.auditEvent.create({
        data: {
          schoolId: sourceCohort.schoolId,
          actorId: actor.user.id,
          action: "COHORT_PROMOTED",
          targetType: "Cohort",
          targetId: sourceCohortId,
          metadata: {
            sourceCohortId,
            sourceLabel: sourceCohort.label,
            destinationCohortId: destCohort!.id,
            destinationLabel,
            destinationAcademicYear,
            membersMoved: activeMembers.length,
            retainHomeroomTeacher,
          },
        },
      });
    });

    revalidatePath(`/admin/cohort/${sourceCohortId}`);
    revalidatePath(`/admin?school=${actor.cohort.schoolId}`);
    return { success: true };
  });
}