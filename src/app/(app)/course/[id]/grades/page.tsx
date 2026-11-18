import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap, Settings2 } from "lucide-react";

import { GradebookGrid } from "@/components/school/gradebook-grid";
import { MarksTable } from "@/components/school/marks-table";
import { TermSelector } from "@/components/school/term-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getCourseGradebook, getStudentCourseMarks } from "@/lib/data/school";
import { getCourseForUser } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Grades" };
export const dynamic = "force-dynamic";

export default async function GradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const { id } = await params;
  const { term: termId } = await searchParams;

  const course = await getCourseForUser(id);
  if (!course) notFound();

  if (!course.isTeacher) {
    const marks = await getStudentCourseMarks(id, termId);

    return (
      <div className="container-feed space-y-5 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Your marks</h2>
          <Button asChild variant="outline" size="sm">
            <Link href={`/course/${id}/attendance`}>Attendance</Link>
          </Button>
        </div>

        <TermSelector
          terms={marks.terms}
          currentId={marks.term?.id ?? null}
          basePath={`/course/${id}/grades`}
        />

        {marks.term === null ? (
          <EmptyState />
        ) : (
          <MarksTable rows={marks.rows} result={marks.result} />
        )}
      </div>
    );
  }

  const gradebook = await getCourseGradebook(id, termId);

  return (
    <div className="container-page space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Gradebook</h2>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/course/${id}/grades/classwork`}>
              Classwork marks
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/course/${id}/grades/settings`}>
              <Settings2 strokeWidth={1.75} />
              Weights &amp; columns
            </Link>
          </Button>
        </div>
      </div>

      <TermSelector
        terms={gradebook.terms}
        currentId={gradebook.term?.id ?? null}
        basePath={`/course/${id}/grades`}
      />

      {gradebook.term === null ? (
        <EmptyState />
      ) : gradebook.categories.length === 0 ? (
        <Card className="p-6">
          <h3 className="text-base font-semibold tracking-tight">
            Set up the gradebook
          </h3>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Add categories and their weights first. The weights must add up to
            100% before marks can count towards a term average.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/course/${id}/grades/settings?term=${gradebook.term.id}`}>
              Choose weights
            </Link>
          </Button>
        </Card>
      ) : (
        <GradebookGrid
          key={gradebook.term.id}
          courseId={id}
          termId={gradebook.term.id}
          students={gradebook.students}
          categories={gradebook.categories}
          items={gradebook.items.map((item) => ({
            id: item.id,
            title: item.title,
            categoryId: item.categoryId,
            maximum: item.maximum,
          }))}
          scores={gradebook.scores}
        />
      )}

      <p className="text-sm text-muted-foreground">
        {gradebook.students.length} student
        {gradebook.students.length === 1 ? "" : "s"} ·{" "}
        {gradebook.items.length} column
        {gradebook.items.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <GraduationCap
        className="size-8 text-muted-foreground"
        strokeWidth={1.5}
        aria-hidden
      />
      <p className="font-medium">No term configured</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        An administrator needs to create a term before grades and attendance can
        be recorded.
      </p>
    </Card>
  );
}
