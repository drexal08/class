import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CourseSettingsForm } from "@/components/course/course-settings-form";
import { getCourseForUser } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Class settings" };
export const dynamic = "force-dynamic";

export default async function CourseSettingsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseForUser(id);
  // Settings are teacher-only; a student gets a 404 rather than a hint that the
  // page exists.
  if (!course || !course.isTeacher) notFound();

  return (
    <div className="container-feed py-6">
      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        Class settings
      </h1>
      <CourseSettingsForm course={course} />
    </div>
  );
}
