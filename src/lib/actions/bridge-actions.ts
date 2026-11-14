"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { AuthError, requireAdmin, requireUser, runAction } from "@/lib/auth/guards";
import { claimLegacyRow } from "@/lib/bridge/claim";
import { pullAllLegacyStudents } from "@/lib/bridge/legacy-sync";
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

/**
 * Admin-only: attaches a staged clabridge row to an LMS account.
 *
 * A student who registered with a different address than the one in Firestore
 * would never claim their import on their own. The administrator points the
 * staged row at the account that exists and the import lands right away.
 */
export async function assignLegacyBridgeStudentAction(
  rowId: string,
  email: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();

    const row = await prisma.bridgeLegacyStudent.findUnique({
      where: { id: rowId },
      select: { id: true, claimedAt: true },
    });
    if (!row) return { error: "That staged student no longer exists" };
    if (row.claimedAt) {
      return { error: "That staged student was already claimed" };
    }

    const address = email.trim();
    if (!address) return { error: "Enter the address of the LMS account" };

    const user = await prisma.user.findFirst({
      where: { email: { equals: address, mode: "insensitive" } },
      select: { id: true, email: true },
    });
    if (!user) return { error: "No LMS account uses that address" };

    const holder = await prisma.bridgeLegacyStudent.findFirst({
      where: { email: user.email, id: { not: row.id } },
      select: { id: true },
    });
    if (holder) {
      return {
        error: "Another staged student already holds that address",
      };
    }

    await prisma.bridgeLegacyStudent.update({
      where: { id: row.id },
      data: { email: user.email },
    });

    await claimLegacyRow({ id: user.id, email: user.email }, row.id);

    revalidatePath("/admin");
  });
}

/**
 * Admin-only: pulls the clabridge students that are not staged yet.
 *
 * The import is automatic for a student who opens the estimator, but an
 * administrator also wants to see who is waiting before that happens. This
 * sweeps the standalone project and stages everyone who is not staged yet.
 */
export async function syncLegacyBridgeStudentsAction(): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();

    const summary = await pullAllLegacyStudents();
    if (summary.disabled) {
      return {
        error:
          "This deployment has no credentials for the standalone CLA Bridge project.",
      };
    }

    revalidatePath("/admin");
    return {
      success: true,
    };
  });
}

/**
 * Admin-only: throws away a staged clabridge row.
 *
 * Some source documents have no address at all and can never be claimed, so
 * an administrator needs a way to clear them out of the way.
 */
export async function discardLegacyBridgeStudentAction(
  rowId: string,
): Promise<ActionState> {
  return runAction(async () => {
    await requireAdmin();

    const row = await prisma.bridgeLegacyStudent.findUnique({
      where: { id: rowId },
      select: { id: true, claimedAt: true },
    });
    if (!row) return { error: "That staged student no longer exists" };
    if (row.claimedAt) {
      return { error: "That staged student was already claimed" };
    }

    await prisma.bridgeLegacyStudent.delete({ where: { id: row.id } });

    revalidatePath("/admin");
  });
}
