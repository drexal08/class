import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCourseById } from "@/lib/actions/course-actions";
import { Header } from "@/components/header";
import { CourseNav } from "@/components/course-nav";
import type { ReactNode } from "react";

export default async function CourseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const courseId = parseInt(id, 10);
  const course = await getCourseById(courseId);
  if (!course) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div
        className="h-1"
        style={{ backgroundColor: course.themeColor }}
      />
      <CourseNav
        courseId={course.id}
        courseName={course.name}
        themeColor={course.themeColor}
        userRole={course.userRole}
      />
      {children}
    </div>
  );
}
