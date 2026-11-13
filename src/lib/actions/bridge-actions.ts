"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AuthError, requireUser, runAction } from "@/lib/auth/guards";
import { bridgeLevelSchema } from "@/lib/bridge/validation";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

/**
 * Sets the student's school level on first visit.
 *
 * Students are locked to their choice; admins can change it. The estimator's
 * level is intentionally separate from the LMS role: a student is still a
 * student in every class.
 */
export async function setBridgeLevelAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();
    if (user.role === "TEACHER" && !user.isAdmin) {
      throw new AuthError("CLA Bridge is for students");
    }

    const parsed = bridgeLevelSchema.safeParse(
      String(formData.get("level") ?? "").toUpperCase(),
    );
    if (!parsed.success) return { error: "Choose a school level" };

    const existing = await prisma.bridgeProfile.findUnique({
      where: { userId: user.id },
      select: { level: true },
    });

    if (
      existing &&
      existing.level !== parsed.data &&
      !user.isAdmin
    ) {
      return {
        error:
          "Your school level is already set. Ask an administrator to change it.",
      };
    }

    await prisma.bridgeProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, level: parsed.data },
      update: { level: parsed.data },
    });

    revalidatePath("/bridge");
    redirect("/bridge");
  });
}
