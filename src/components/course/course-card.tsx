import Link from "next/link";
import { ClipboardList, Users, ArrowRight, CheckCircle, AlertCircle } from "lucide-react";

import { ClassCode } from "@/components/course/class-code";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
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
    progress?: number; // 0-100
    upcomingCount?: number;
  };
  role: "TEACHER" | "STUDENT";
  variant?: "default" | "compact" | "detailed";
};

const VARIANT_CLASSES = {
  default: "group relative overflow-hidden transition-all duration-200 hover:shadow-lg",
  compact: "group relative overflow-hidden transition-shadow hover:shadow-md",
  detailed: "group relative overflow-hidden transition-all duration-200 hover:shadow-xl",
};

/**
 * Modern course card with blue accent system.
 * Supports three variants: default (grid), compact (list), detailed (featured).
 */
export function CourseCard({ course, role, variant = "default" }: CourseCardProps) {
  const accent = accentClasses(course.accent);
  const isArchived = course.archived;
  const progress = course.progress ?? 0;
  const hasProgress = typeof course.progress === "number";

  return (
    <Card
      className={cn(
        VARIANT_CLASSES[variant],
        isArchived && "opacity-70 ring-1 ring-border"
      )}
    >
      {/* Accent indicator - top border for detailed, left border for others */}
      {variant === "detailed" ? (
        <div
          className={cn("h-1 w-full", accent.rule)}
          aria-hidden
        />
      ) : (
        <span
          className={cn("absolute inset-y-0 left-0 w-1", accent.rule)}
          aria-hidden
        />
      )}

      <CardContent className={cn(
        "p-5",
        variant === "compact" && "py-3 pl-6",
        variant === "detailed" && "p-6"
      )}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="truncate text-base font-semibold leading-tight tracking-tight">
                <Link
                  href={`/course/${course.id}`}
                  className={cn(
                    "outline-none after:absolute after:inset-0 focus-visible:underline",
                    isArchived && "text-muted-foreground"
                  )}
                >
                  {course.name}
                </Link>
              </h3>

              {isArchived && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Archived
                </Badge>
              )}

              {role === "STUDENT" && hasProgress && progress === 100 && (
                <Badge variant="success" className="text-xs shrink-0 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Complete
                </Badge>
              )}

              {role === "STUDENT" && course.upcomingCount && course.upcomingCount > 0 && (
                <Badge variant="warning" className="text-xs shrink-0 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {course.upcomingCount} due
                </Badge>
              )}
            </div>

            {(course.section || course.subject) && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {[course.section, course.subject].filter(Boolean).join(" · ")}
              </p>
            )}

            {variant === "detailed" && (
              <div className="mt-3 flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {course._count?.enrollments ?? 0} students
                </span>
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="size-3.5" strokeWidth={1.75} aria-hidden />
                  {course._count?.assignments ?? 0} assignments
                </span>
              </div>
            )}
          </div>

          <Badge
            variant={variant === "detailed" ? "outline" : "outline"}
            className={cn("shrink-0", variant === "detailed" && "text-sm")}
          >
            {role === "STUDENT" ? "Student" : "Teacher"}
          </Badge>
        </div>

        {/* Progress bar for students */}
        {role === "STUDENT" && hasProgress && (
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" max={100} />
          </div>
        )}

        {/* Teacher info */}
        <p className={cn("mt-4 truncate text-sm text-muted-foreground", variant === "compact" && "mt-2")}>
          {displayNameOf(course.teacher)}
        </p>

        {/* Stats row for default variant */}
        {variant === "default" && course._count && (
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

        {/* Class code for teachers */}
        {role !== "STUDENT" && !isArchived && (
          <div className={cn(
            "relative z-10 mt-4 border-t border-border pt-3",
            variant === "compact" && "mt-2 pt-2",
            variant === "detailed" && "mt-4 pt-4"
          )}>
            <div className="flex items-center justify-between">
              <ClassCode code={course.code} size="sm" />
              <Link
                href={`/course/${course.id}`}
                className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
              >
                Open class
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        )}

        {/* Detailed variant: action buttons */}
        {variant === "detailed" && role !== "STUDENT" && !isArchived && (
          <div className="mt-6 flex items-center gap-3 pt-4 border-t border-border">
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/course/${course.id}/classwork`}>Classwork</Link>
            </Button>
            <Button asChild variant="outline" className="flex-1">
              <Link href={`/course/${course.id}/grades`}>Grades</Link>
            </Button>
            <Button asChild variant="default" className="flex-1">
              <Link href={`/course/${course.id}/people`}>People</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Compact course card for list views
 */
export function CourseCardCompact({ course, role }: Omit<CourseCardProps, "variant">) {
  return <CourseCard course={course} role={role} variant="compact" />;
}

/**
 * Detailed course card for featured/hero views
 */
export function CourseCardDetailed({ course, role }: Omit<CourseCardProps, "variant">) {
  return <CourseCard course={course} role={role} variant="detailed" />;
}