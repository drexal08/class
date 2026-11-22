"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireSchoolAdmin, runAction } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import { termSchema } from "@/lib/school/validation";

/**
 * Term administration. Terms are school-scoped; only a school admin may change
 * them.
 */

export async function createTermAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const parsed = termSchema.safeParse({
      academicYear: formData.get("academicYear"),
      name: formData.get("name"),
      startsOn: formData.get("startsOn"),
      endsOn: formData.get("endsOn"),
      isActive: formData.get("isActive") === "true",
      schoolId: formData.get("schoolId"),
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const schoolId = parsed.data.schoolId;
    if (!schoolId) return { error: "School is required" };

    await requireSchoolAdmin(schoolId);

    const { academicYear, name, startsOn, endsOn, isActive } = parsed.data;

    const duplicate = await prisma.term.findFirst({
      where: { schoolId, academicYear, name },
      select: { id: true },
    });
    if (duplicate) {
      return { error: `${name} already exists in ${academicYear} for this school` };
    }

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      if (isActive) {
        await tx.term.updateMany({
          where: { schoolId, isActive: true },
          data: { isActive: false },
        });
      }
      await tx.term.create({
        data: { schoolId, academicYear, name, startsOn, endsOn, isActive },
      });
    });

    revalidatePath(`/admin?school=${schoolId}`);
    revalidatePath("/grades");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}

/** Makes one term the default for new gradebook entries. */
export async function activateTermAction(termId: string): Promise<ActionState> {
  return runAction(async () => {
    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { id: true, schoolId: true },
    });
    if (!term) return { error: "That term no longer exists" };

    await requireSchoolAdmin(term.schoolId ?? "");

    await prisma.$transaction([
      prisma.term.updateMany({
        where: { schoolId: term.schoolId, isActive: true },
        data: { isActive: false },
      }),
      prisma.term.update({ where: { id: termId }, data: { isActive: true } }),
    ]);

    revalidatePath(`/admin?school=${term.schoolId}`);
    revalidatePath("/grades");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}
