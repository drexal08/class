import "server-only";

import { prisma } from "@/lib/prisma";
import { publish, userChannel } from "@/lib/realtime/server";
import type { NotificationType } from "@/generated/prisma/client";

type NotifyInput = {
  courseId: string;
  type: NotificationType;
  title: string;
  body?: string;
  linkPath?: string;
  /** The person who caused the event — never notified about their own action. */
  actorId: string;
  /** Restrict to specific recipients; defaults to the whole class. */
  recipientIds?: string[];
};

/**
 * Fans a notification out to a course's members.
 *
 * Failures are logged and swallowed: a notification is a courtesy, and losing
 * one must never roll back the assignment or grade that triggered it.
 */
export async function notifyCourse(input: NotifyInput): Promise<void> {
  try {
    const recipients =
      input.recipientIds ??
      (
        await prisma.enrollment.findMany({
          where: { courseId: input.courseId, userId: { not: input.actorId } },
          select: { userId: true },
        })
      ).map((enrollment) => enrollment.userId);

    const targets = recipients.filter((id) => id !== input.actorId);
    if (targets.length === 0) return;

    await prisma.notification.createMany({
      data: targets.map((userId) => ({
        userId,
        courseId: input.courseId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        linkPath: input.linkPath ?? null,
      })),
    });

    await Promise.all(
      targets.map((userId) =>
        publish(userChannel(userId), "comment:new", { actorId: input.actorId }),
      ),
    );
  } catch (error) {
    console.error("[notify] Could not deliver notifications", error);
  }
}
