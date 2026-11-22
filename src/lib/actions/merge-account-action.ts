"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { AuthError, requireUser, runAction } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase/admin";
import { requireSuperuser } from "@/lib/sdms/access";
import type { ActionState } from "@/lib/types";

const mergeAccountSchema = z.object({
  primaryUserId: z.string().min(1),
  duplicateUserId: z.string().min(1),
  confirmation: z.literal("MERGE"),
});

export async function mergeAccountsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const actor = await requireSuperuser();

    const parsed = mergeAccountSchema.safeParse({
      primaryUserId: formData.get("primaryUserId"),
      duplicateUserId: formData.get("duplicateUserId"),
      confirmation: formData.get("confirmation"),
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid request" };

    const { primaryUserId, duplicateUserId } = parsed.data;
    if (primaryUserId === duplicateUserId) return { error: "Cannot merge an account with itself" };

    const [primary, duplicate] = await Promise.all([
      prisma.user.findUnique({ where: { id: primaryUserId }, select: { id: true, email: true, role: true, platformRole: true, studentCode: true, authKind: true, archivedAt: true } }),
      prisma.user.findUnique({ where: { id: duplicateUserId }, select: { id: true, email: true, role: true, platformRole: true, studentCode: true, authKind: true, archivedAt: true } }),
    ]);
    if (!primary || !duplicate) return { error: "One or both accounts not found" };
    if (primary.archivedAt || duplicate.archivedAt) return { error: "Cannot merge archived accounts" };
    if (primary.role === "STUDENT" && duplicate.role === "STUDENT" && primary.studentCode && duplicate.studentCode && primary.studentCode !== duplicate.studentCode) {
      return { error: "Cannot merge two different student codes" };
    }

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      // 1. Reassign ownership of created content
      await tx.course.updateMany({ where: { teacherId: duplicateUserId }, data: { teacherId: primaryUserId } });
      await tx.assignment.updateMany({ where: { courseId: { in: (await tx.course.findMany({ where: { teacherId: duplicateUserId }, select: { id: true } })).map(c => c.id) } }, data: {} });
      await tx.topic.updateMany({ where: { courseId: { in: (await tx.course.findMany({ where: { teacherId: duplicateUserId }, select: { id: true } })).map(c => c.id) } }, data: {} });
      await tx.announcement.updateMany({ where: { authorId: duplicateUserId }, data: { authorId: primaryUserId } });
      await tx.rubricCriterion.updateMany({ where: { assignmentId: { in: (await tx.assignment.findMany({ where: { courseId: { in: (await tx.course.findMany({ where: { teacherId: duplicateUserId }, select: { id: true } })).map(c => c.id) } }, select: { id: true } })).map(a => a.id) } }, data: {} });
      await tx.gradeCategory.updateMany({ where: { courseId: { in: (await tx.course.findMany({ where: { teacherId: duplicateUserId }, select: { id: true } })).map(c => c.id) } }, data: {} });
      await tx.gradeItem.updateMany({ where: { courseId: { in: (await tx.course.findMany({ where: { teacherId: duplicateUserId }, select: { id: true } })).map(c => c.id) } }, data: {} });

      // 2. Reassign enrollments (merge, keeping active)
      const dupEnrollments = await tx.enrollment.findMany({ where: { userId: duplicateUserId }, select: { id: true, courseId: true, role: true, active: true } });
      for (const e of dupEnrollments) {
        const existing = await tx.enrollment.findUnique({ where: { userId_courseId: { userId: primaryUserId, courseId: e.courseId } } });
        if (existing) {
          if (!existing.active && e.active) await tx.enrollment.update({ where: { id: existing.id }, data: { active: true, leftAt: null } });
          if (e.role === "TEACHER" && existing.role === "STUDENT") await tx.enrollment.update({ where: { id: existing.id }, data: { role: "TEACHER" } });
          await tx.enrollment.delete({ where: { id: e.id } });
        } else {
          await tx.enrollment.update({ where: { id: e.id }, data: { userId: primaryUserId } });
        }
      }

      // 3. Reassign submissions
      await tx.submission.updateMany({ where: { studentId: duplicateUserId }, data: { studentId: primaryUserId } });

      // 4. Reassign attendance
      await tx.attendanceRecord.updateMany({ where: { studentId: duplicateUserId }, data: { studentId: primaryUserId } });
      await tx.attendanceSession.updateMany({ where: { markedById: duplicateUserId }, data: { markedById: primaryUserId } });

      // 5. Reassign grade scores
      await tx.gradeScore.updateMany({ where: { studentId: duplicateUserId }, data: { studentId: primaryUserId } });

      // 6. Reassign report comments
      await tx.reportComment.updateMany({ where: { studentId: duplicateUserId }, data: { studentId: primaryUserId } });
      await tx.reportComment.updateMany({ where: { authorId: duplicateUserId }, data: { authorId: primaryUserId } });

      // 7. Reassign attachments
      await tx.attachment.updateMany({ where: { uploadedById: duplicateUserId }, data: { uploadedById: primaryUserId } });

      // 8. Reassign notifications
      await tx.notification.updateMany({ where: { userId: duplicateUserId }, data: { userId: primaryUserId } });

      // 9. Reassign CLA Bridge data
      await tx.bridgeProfile.updateMany({ where: { userId: duplicateUserId }, data: { userId: primaryUserId } });
      await tx.bridgeEstimate.updateMany({ where: { userId: duplicateUserId }, data: { userId: primaryUserId } });

      // 10. Merge school memberships
      const dupMembers = await tx.schoolMember.findMany({ where: { userId: duplicateUserId } });
      for (const m of dupMembers) {
        const existing = await tx.schoolMember.findUnique({ where: { schoolId_userId: { schoolId: m.schoolId, userId: primaryUserId } } });
        if (existing) {
          if (m.role === "ADMIN" && existing.role === "TEACHER") await tx.schoolMember.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
          if (m.status === "ACTIVE" && existing.status !== "ACTIVE") await tx.schoolMember.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
          await tx.schoolMember.delete({ where: { id: m.id } });
        } else {
          await tx.schoolMember.update({ where: { id: m.id }, data: { userId: primaryUserId } });
        }
      }

      // 11. Merge cohort memberships
      const dupCohortMembers = await tx.cohortMember.findMany({ where: { userId: duplicateUserId } });
      for (const m of dupCohortMembers) {
        const existing = await tx.cohortMember.findUnique({ where: { cohortId_userId: { cohortId: m.cohortId, userId: primaryUserId } } });
        if (existing) {
          if (m.status === "ACTIVE" && existing.status !== "ACTIVE") await tx.cohortMember.update({ where: { id: existing.id }, data: { status: "ACTIVE" } });
          if (m.claimedAt && !existing.claimedAt) await tx.cohortMember.update({ where: { id: existing.id }, data: { claimedAt: m.claimedAt, claimedIpHash: m.claimedIpHash } });
          if (m.mustChangePassword && !existing.mustChangePassword) await tx.cohortMember.update({ where: { id: existing.id }, data: { mustChangePassword: true } });
          await tx.cohortMember.delete({ where: { id: m.id } });
        } else {
          await tx.cohortMember.update({ where: { id: m.id }, data: { userId: primaryUserId } });
        }
      }

      // 12. Merge auth identities
      const dupIdentities = await tx.authIdentity.findMany({ where: { userId: duplicateUserId } });
      for (const i of dupIdentities) {
        const existing = await tx.authIdentity.findUnique({ where: { provider_projectId_providerUid: { provider: i.provider, projectId: i.projectId, providerUid: i.providerUid } } });
        if (existing) {
          await tx.authIdentity.delete({ where: { id: i.id } });
        } else {
          await tx.authIdentity.update({ where: { id: i.id }, data: { userId: primaryUserId } });
        }
      }

      // 13. Archive duplicate user
      await tx.user.update({ where: { id: duplicateUserId }, data: { archivedAt: new Date(), email: `merged-${duplicateUserId}@archived.local` } });

      // 14. Revoke Firebase tokens for duplicate
      const admin = await getAdminAuth();
      if (admin) {
        try { await admin.revokeRefreshTokens(duplicateUserId); } catch {}
      }

      // 15. Audit
      await tx.auditEvent.create({
        data: {
          actorId: actor.id,
          action: "ACCOUNT_MERGED",
          targetType: "User",
          targetId: primaryUserId,
          metadata: { mergedUserId: duplicateUserId, mergedEmail: duplicate.email },
        },
      });
    });

    revalidatePath("/dashboard");
    revalidatePath("/admin");
    revalidatePath("/platform");
    return { success: true };
  });
}