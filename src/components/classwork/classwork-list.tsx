import Link from "next/link";
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  FileText,
  ListChecks,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { ClassworkItem } from "@/lib/data/classwork";
import { ASSIGNMENT_LABELS, SUBMISSION_LABELS, SUBMISSION_TONES } from "@/lib/types";
import { cn, formatDueDate, isOverdue } from "@/lib/utils";

const TYPE_ICONS = {
  ASSIGNMENT: ClipboardList,
  QUIZ: ListChecks,
  QUESTION: CircleHelp,
  MATERIAL: BookOpen,
} as const;

export function ClassworkList({
  items,
  courseId,
  isTeacher,
  totalStudents,
}: {
  items: ClassworkItem[];
  courseId: string;
  isTeacher: boolean;
  totalStudents: number;
}) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => {
        const Icon = TYPE_ICONS[item.type] ?? FileText;
        const overdue =
          !isTeacher &&
          item.type !== "MATERIAL" &&
          isOverdue(item.dueDate) &&
          (!item.mySubmission || item.mySubmission.status === "ASSIGNED");

        return (
          <li key={item.id}>
            <Link
              href={`/course/${courseId}/classwork/${item.id}`}
              className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-secondary/50"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                <Icon
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-hidden
                />
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{item.title}</span>

                  {!item.published && (
                    <Badge variant="outline">Draft</Badge>
                  )}

                  {overdue && <Badge variant="danger">Missing</Badge>}

                  {!isTeacher && item.mySubmission && (
                    <Badge
                      variant="outline"
                      className={cn(SUBMISSION_TONES[item.mySubmission.status])}
                    >
                      {SUBMISSION_LABELS[item.mySubmission.status]}
                    </Badge>
                  )}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {ASSIGNMENT_LABELS[item.type]}
                  {item.type !== "MATERIAL" && ` · ${item.maxPoints} points`}
                  {item.dueDate && ` · ${formatDueDate(item.dueDate)}`}
                </p>
              </div>

              <div className="shrink-0 text-right text-xs text-muted-foreground">
                {isTeacher && item.type !== "MATERIAL" ? (
                  <>
                    <span className="block font-medium text-foreground">
                      {item.turnedInCount}/{totalStudents}
                    </span>
                    turned in
                  </>
                ) : !isTeacher &&
                  item.mySubmission?.grade !== null &&
                  item.mySubmission?.grade !== undefined ? (
                  <>
                    <span className="block font-medium text-foreground">
                      {item.mySubmission.grade}/{item.maxPoints}
                    </span>
                    graded
                  </>
                ) : null}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ClassworkGroup({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      {title && (
        <h2 className="mb-2 px-1 text-sm font-medium text-muted-foreground">
          {title}
        </h2>
      )}
      <Card className="overflow-hidden">{children}</Card>
    </section>
  );
}
