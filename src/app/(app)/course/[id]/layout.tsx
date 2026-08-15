import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Archive, ChevronLeft } from "lucide-react";

import { ClassCode } from "@/components/course/class-code";
import { CourseNav } from "@/components/course/course-nav";
import { RealtimeRefresher } from "@/components/course/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCourseForUser } from "@/lib/data/courses";
import { accentClasses, cn, displayNameOf } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const course = await getCourseForUser(id);

  return {
    title: course?.name ?? "Class",
    robots: { index: false, follow: false },
  };
}

export default async function CourseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const course = await getCourseForUser(id);

  // Returns null both when the class doesn't exist and when the viewer isn't a
  // member — a 404 either way, so membership isn't leaked.
  if (!course) notFound();

  const accent = accentClasses(course.accent);

  return (
    <>
      <RealtimeRefresher courseId={course.id} />

      <div className="border-b border-border bg-card">
        <div className="container-page">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mt-4">
            <Link href="/dashboard">
              <ChevronLeft />
              Classes
            </Link>
          </Button>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-4 pb-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <span
                  className={cn("h-8 w-1 rounded-full", accent.rule)}
                  aria-hidden
                />
                <div className="min-w-0">
                  <h1 className="truncate text-xl font-semibold tracking-tight">
                    {course.name}
                  </h1>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {[course.section, course.subject, course.room]
                      .filter(Boolean)
                      .join(" · ") || displayNameOf(course.teacher)}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {course.archived && (
                <Badge variant="warning">
                  <Archive className="size-3" />
                  Archived
                </Badge>
              )}
              {course.isTeacher && (
                <ClassCode
                  code={course.code}
                  courseId={course.id}
                  showInviteLink
                />
              )}
            </div>
          </div>

          <CourseNav courseId={course.id} isTeacher={course.isTeacher} />
        </div>
      </div>

      {children}
    </>
  );
}
