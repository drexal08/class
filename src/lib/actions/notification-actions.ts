"use server";

import { revalidatePath } from "next/cache";

import { requireUser, runAction } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import type { ActionState } from "@/lib/types";

export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();

    // Scoping by userId is the authorization check.
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    revalidatePath("/dashboard");
  });
}

export async function markAllNotificationsReadAction(): Promise<ActionState> {
  return runAction(async () => {
    const user = await requireUser();

    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });

    revalidatePath("/dashboard");
  });
}
