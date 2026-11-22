"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireActiveCourseManager, runAction } from "@/lib/auth/guards";
import type { ActionState } from "@/lib/types";
import { firstIssue } from "@/lib/validators";
import { findOverlaps, formatTimeRange, validateSlot, WEEKDAY_LABELS } from "@/lib/school/schedule";
import { saveScheduleSchema } from "@/lib/school/validation";

/**
 * Replaces a course's weekly timetable.
 *
 * The whole week is submitted at once, so an overlap between two rows in the
 * same save is caught here rather than by a unique constraint that cannot
 * express "overlapping time ranges".
 */
export async function saveScheduleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return runAction(async () => {
    const weekdays = formData.getAll("weekday").map(String);
    const startsAt = formData.getAll("startsAt").map(String);
    const endsAt = formData.getAll("endsAt").map(String);
    const rooms = formData.getAll("room").map(String);

    const slots = weekdays
      .map((weekday, index) => ({
        weekday,
        startsAt: startsAt[index] ?? "",
        endsAt: endsAt[index] ?? "",
        room: rooms[index] ?? "",
      }))
      .filter((slot) => slot.startsAt.length > 0 && slot.endsAt.length > 0);

    const parsed = saveScheduleSchema.safeParse({
      courseId: formData.get("courseId"),
      slots,
    });
    if (!parsed.success) return { error: firstIssue(parsed.error) };

    const { courseId, slots: cleaned } = parsed.data;
    await requireActiveCourseManager(courseId);

    for (const slot of cleaned) {
      const error = validateSlot(slot);
      if (error) {
        return {
          error: `${WEEKDAY_LABELS[slot.weekday]}: ${error}`,
        };
      }
    }

    const overlaps = findOverlaps(cleaned);
    if (overlaps.length > 0) {
      const [first, second] = overlaps[0];
      return {
        error: `${WEEKDAY_LABELS[first.weekday]} has two overlapping slots (${formatTimeRange(
          first.startsAt,
          first.endsAt,
        )} and ${formatTimeRange(second.startsAt, second.endsAt)})`,
      };
    }

    await prisma.$transaction(async (tx: import("@/generated/prisma/client").Prisma.TransactionClient) => {
      await tx.courseSchedule.deleteMany({ where: { courseId } });
      if (cleaned.length > 0) {
        await tx.courseSchedule.createMany({
          data: cleaned.map((slot) => ({
            courseId,
            weekday: slot.weekday,
            startsAt: slot.startsAt,
            endsAt: slot.endsAt,
            room: slot.room ?? null,
          })),
        });
      }
    });

    revalidatePath(`/course/${courseId}/settings`);
    revalidatePath(`/course/${courseId}`);
    revalidatePath("/dashboard");
    revalidatePath("/calendar");
  });
}
