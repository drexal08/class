import type { Metadata } from "next";
import Link from "next/link";
import { Archive, ChevronLeft } from "lucide-react";

import { CourseCard } from "@/components/course/course-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { listArchivedCourses } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Archived classes" };
export const dynamic = "force-dynamic";

export default async function ArchivedPage() {
  const courses = await listArchivedCourses();

  return (
    <div className="container-page py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href="/dashboard">
          <ChevronLeft />
          Classes
        </Link>
      </Button>

      <h1 className="text-2xl font-semibold tracking-tight">Archived classes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Archived classes are read-only. Restore one from its settings page to
        start using it again.
      </p>

      {courses.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon={Archive}
          title="Nothing archived"
          description="Classes you archive will be kept here, along with all their work."
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <li key={course.id}>
              <CourseCard
                course={{ ...course, _count: undefined }}
                role={course.enrollmentRole}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
