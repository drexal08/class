import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCalendarItems } from "@/lib/data/todo";
import { ASSIGNMENT_LABELS, SUBMISSION_LABELS, SUBMISSION_TONES } from "@/lib/types";
import { accentClasses, cn, isOverdue } from "@/lib/utils";

export const metadata: Metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const items = await getCalendarItems();

  // Grouped by day rather than drawn as a month grid: a chronological list is
  // easier to scan and works on a phone, which is where students check it.
  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = new Date(item.dueDate!).toDateString();
    const bucket = groups.get(key) ?? [];
    bucket.push(item);
    groups.set(key, bucket);
  }

  return (
    <div className="container-feed py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every dated item across your active classes, in order.
      </p>

      {items.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={CalendarDays}
          title="Nothing scheduled"
          description="Work with a due date will appear here automatically."
        />
      ) : (
        <div className="mt-8 space-y-8">
          {[...groups.entries()].map(([day, dayItems]) => (
            <section key={day}>
              <h2 className="flex items-baseline gap-2 text-sm font-medium">
                {formatDayHeading(new Date(day))}
                {isOverdue(day) && (
                  <span className="text-xs font-normal text-muted-foreground">
                    past
                  </span>
                )}
              </h2>

              <Card className="mt-3 overflow-hidden">
                <ul className="divide-y divide-border">
                  {dayItems.map((item) => {
                    const status = item.submissions[0]?.status;
                    return (
                      <li key={item.id}>
                        <Link
                          href={`/course/${item.course.id}/classwork/${item.id}`}
                          className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-secondary/50"
                        >
                          <span
                            className={cn(
                              "h-8 w-1 shrink-0 rounded-full",
                              accentClasses(item.course.accent).rule,
                            )}
                            aria-hidden
                          />

                          <span className="w-16 shrink-0 text-xs text-muted-foreground tabular-nums">
                            {new Date(item.dueDate!).toLocaleTimeString("en-US", {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {item.course.name} · {ASSIGNMENT_LABELS[item.type]}
                            </span>
                          </span>

                          {status && (
                            <Badge
                              variant="outline"
                              className={cn("shrink-0", SUBMISSION_TONES[status])}
                            >
                              {SUBMISSION_LABELS[status]}
                            </Badge>
                          )}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function formatDayHeading(date: Date): string {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === tomorrow.toDateString()) return "Tomorrow";

  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: "numeric" }),
  });
}
