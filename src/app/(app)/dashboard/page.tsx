import type { Metadata } from "next";
import Link from "next/link";
import { Archive, GraduationCap } from "lucide-react";

import { CourseCard } from "@/components/course/course-card";
import { CreateCourseDialog } from "@/components/course/create-course-dialog";
import { JoinCourseDialog } from "@/components/course/join-course-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserCourses } from "@/lib/data/courses";
import { displayNameOf } from "@/lib/utils";

export const metadata: Metadata = { title: "Classes" };

// Reads cookies and per-user data, so it must never be prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const courses = await listUserCourses();

  const canCreate = user?.role === "TEACHER" || user?.role === "ADMIN";
  const teaching = courses.filter((course) => course.enrollmentRole !== "STUDENT");
  const enrolled = courses.filter((course) => course.enrollmentRole === "STUDENT");

  return (
    <div className="container-page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting()}, {displayNameOf(user ?? {}).split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {courses.length === 0
              ? "You are not in any classes yet."
              : `${courses.length} active ${courses.length === 1 ? "class" : "classes"}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/archived">
              <Archive />
              Archived
            </Link>
          </Button>
          <JoinCourseDialog />
          {canCreate && <CreateCourseDialog />}
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={GraduationCap}
          title="No classes yet"
          description={
            canCreate
              ? "Create your first class, or join one with a code from another teacher."
              : "Ask your teacher for the seven-character class code, then join to see your work."
          }
          action={
            <div className="flex items-center gap-2">
              <JoinCourseDialog />
              {canCreate && <CreateCourseDialog />}
            </div>
          }
        />
      ) : (
        <div className="mt-8 space-y-10">
          {teaching.length > 0 && (
            <CourseSection title="Teaching" courses={teaching} />
          )}
          {enrolled.length > 0 && (
            <CourseSection title="Enrolled" courses={enrolled} />
          )}
        </div>
      )}
    </div>
  );
}

function CourseSection({
  title,
  courses,
}: {
  title: string;
  courses: Awaited<ReturnType<typeof listUserCourses>>;
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <li key={course.id}>
            <CourseCard course={course} role={course.enrollmentRole} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
