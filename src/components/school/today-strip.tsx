import Link from "next/link";
import { Clock } from "lucide-react";

import { formatTimeRange, timeToMinutes } from "@/lib/school/schedule";
import { accentClasses, cn } from "@/lib/utils";

type Slot = {
  id: string;
  courseId: string;
  startsAt: string;
  endsAt: string;
  room: string | null;
  course: { name: string; accent: string | null };
};

/**
 * Today's lessons, in order. "Now" is derived from the school-local minute of
 * the day, not the browser's clock.
 */
export function TodayStrip({
  slots,
  minutesNow,
}: {
  slots: Slot[];
  minutesNow: number;
}) {
  if (slots.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
        No classes scheduled for today.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {slots.map((slot) => {
        const start = timeToMinutes(slot.startsAt) ?? 0;
        const end = timeToMinutes(slot.endsAt) ?? 0;
        const ended = minutesNow >= end;
        const current = minutesNow >= start && minutesNow < end;

        return (
          <li key={slot.id}>
            <Link
              href={`/course/${slot.courseId}`}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50",
                ended && "opacity-55",
              )}
            >
              <span
                className={cn(
                  "h-8 w-1 shrink-0 rounded-full",
                  accentClasses(slot.course.accent).rule,
                )}
                aria-hidden
              />
              <span className="w-32 shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatTimeRange(slot.startsAt, slot.endsAt)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {slot.course.name}
                </span>
                {slot.room && (
                  <span className="block truncate text-xs text-muted-foreground">
                    {slot.room}
                  </span>
                )}
              </span>
              {current && (
                <span className="flex shrink-0 items-center gap-1 rounded-full border border-success/20 bg-success-muted px-2 py-0.5 text-xs font-medium text-success">
                  <Clock className="size-3" strokeWidth={2} aria-hidden />
                  Now
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
