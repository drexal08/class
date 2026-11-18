import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseSettingsForm } from "@/components/course/course-settings-form";
import { ScheduleEditor } from "@/components/school/schedule-editor";
import { Card } from "@/components/ui/card";
import { getCourseForUser } from "@/lib/data/courses";
import { getCourseSchedule } from "@/lib/data/school";

export const metadata: Metadata = { title: "Class settings" };
export const dynamic = "force-dynamic";

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseForUser(id);
  // Settings are teacher-only; a student or a read-only administrator gets a
  // 404 rather than a hint that the page exists.
  if (!course || !course.canManage) notFound();

  const schedule = await getCourseSchedule(id);

  return (
    <div className="container-feed space-y-6 py-6">
      <h2 className="text-xl font-semibold tracking-tight">
        Class settings
      </h2>
      <CourseSettingsForm course={course} />

      <Card className="p-6">
        <h3 className="text-base font-semibold leading-tight tracking-tight">
          Weekly timetable
        </h3>
        <p className="mt-1 mb-4 max-w-prose text-sm text-muted-foreground">
          The days and times this class meets. This is a recurring weekly
          pattern, not a dated calendar, and it feeds the dashboard and calendar.
        </p>
        <ScheduleEditor courseId={id} slots={schedule} />
      </Card>
    </div>
  );
}
