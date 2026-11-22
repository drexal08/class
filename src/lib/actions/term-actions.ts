"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin, runAction } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import { termSchema } from "@/lib/school/validation";

/**
 * Term administration. Terms are global, so only an administrator may change
 * them — a teacher controls the categories inside a term, not the calendar.
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
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    await requireAdmin();

    const { academicYear, name, startsOn, endsOn, isActive } = parsed.data;

    const duplicate = await prisma.term.findFirst({
      where: { academicYear, name },
      select: { id: true },
    });
    if (duplicate) {
      return { error: `${name} already exists in ${academicYear}` };
    }

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      if (isActive) {
        await tx.term.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        });
      }
      await tx.term.create({
        data: { academicYear, name, startsOn, endsOn, isActive },
      });
    });

    revalidatePath("/admin");
    revalidatePath("/grades");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}

/** Makes one term the default for new gradebook entries. */
export async function activateTermAction(termId: string): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();

    const term = await prisma.term.findUnique({
      where: { id: termId },
      select: { id: true },
    });
    if (!term) return { error: "That term no longer exists" };

    await prisma.$transaction([
      prisma.term.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      }),
      prisma.term.update({ where: { id: termId }, data: { isActive: true } }),
    ]);

    revalidatePath("/admin");
    revalidatePath("/grades");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  });
}
