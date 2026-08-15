import Link from "next/link";
import { ClipboardList, Users } from "lucide-react";

import { ClassCode } from "@/components/course/class-code";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { accentClasses, cn, displayNameOf } from "@/lib/utils";

type CourseCardProps = {
  course: {
    id: string;
    name: string;
    section: string | null;
    subject: string | null;
    code: string;
    accent: string;
    archived?: boolean;
    teacher: { displayName: string | null; email: string | null };
    _count?: { enrollments: number; assignments: number };
  };
  role: "ADMIN" | "TEACHER" | "STUDENT";
};

/**
 * The course accent appears only as a thin left rule — never as a filled
 * header. Colour identifies the class without competing with its content.
 */
export function CourseCard({ course, role }: CourseCardProps) {
  const accent = accentClasses(course.accent);

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <span
        className={cn("absolute inset-y-0 left-0 w-1", accent.rule)}
        aria-hidden
      />

      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight">
              <Link
                href={`/course/${course.id}`}
                className="outline-none after:absolute after:inset-0 focus-visible:underline"
              >
                {course.name}
              </Link>
            </h3>
            {(course.section || course.subject) && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[course.section, course.subject].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>

          <Badge variant="outline" className="shrink-0">
            {role === "STUDENT" ? "Student" : "Teacher"}
          </Badge>
        </div>

        <p className="mt-4 truncate text-sm text-muted-foreground">
          {displayNameOf(course.teacher)}
        </p>

        {course._count && (
          <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" strokeWidth={1.75} aria-hidden />
              {course._count.enrollments}
              <span className="sr-only">people</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ClipboardList className="size-3.5" strokeWidth={1.75} aria-hidden />
              {course._count.assignments}
              <span className="sr-only">items of classwork</span>
            </span>
          </div>
        )}

        {/* Teachers need the code to hand out; students already used it.
            `relative z-10` keeps the copy button clickable above the card's
            full-surface link overlay. */}
        {role !== "STUDENT" && (
          <div className="relative z-10 mt-4 border-t border-border pt-3">
            <ClassCode code={course.code} size="sm" />
          </div>
        )}
      </div>
    </Card>
  );
}
