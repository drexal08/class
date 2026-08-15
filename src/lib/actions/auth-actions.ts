"use server";

import { redirect } from "next/navigation";

import { requireAdmin, requireUser, runAction } from "@/lib/auth/guards";
import { destroySession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";
import { revalidatePath } from "next/cache";

/** Clears the session cookie and revokes the Firebase refresh tokens. */
export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Lets a user correct their own display name. */
export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();

    const displayName = String(formData.get("displayName") ?? "").trim();
    if (displayName.length < 2) {
      return { error: "Name must be at least 2 characters" };
    }
    if (displayName.length > 80) {
      return { error: "Name is too long" };
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { displayName },
    });

    revalidatePath("/settings");
    revalidatePath("/dashboard");
  });
}

/**
 * Admin-only role change.
 *
 * Roles are never settable by the account holder — the sign-in route only
 * honours an intended role when creating a brand-new user, and this action is
 * the sole path to changing one afterwards.
 */
export async function setUserRoleAction(
  userId: string,
  role: "ADMIN" | "TEACHER" | "STUDENT",
): Promise<ActionState> {
  return runAction(async () => {
    const admin = await requireAdmin();

    if (admin.id === userId && role !== "ADMIN") {
      return { error: "You cannot remove your own admin access" };
    }

    await prisma.user.update({ where: { id: userId }, data: { role } });
    revalidatePath("/admin");
  });
}
