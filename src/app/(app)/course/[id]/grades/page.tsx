import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { GradebookTable } from "@/components/gradebook/gradebook-table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getCourseForUser } from "@/lib/data/courses";
import { getGradebook, getStudentGrades } from "@/lib/data/grading";
import { formatGrade } from "@/lib/grades";
import { SUBMISSION_LABELS, SUBMISSION_TONES } from "@/lib/types";
import { cn, formatDueDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Grades" };
export const dynamic = "force-dynamic";

export default async function GradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseForUser(id);
  if (!course) notFound();

  // Teachers see the whole class; students see only their own grades.
  if (!course.isTeacher) {
    const grades = await getStudentGrades(id);

    if (grades.length === 0) {
      return (
        <div className="container-feed py-6">
          <EmptyState
            icon={GraduationCap}
            title="No grades yet"
            description="Once your teacher grades your work, it will show up here."
          />
        </div>
      );
    }

    return (
      <div className="container-feed py-6">
        <h1 className="text-xl font-semibold tracking-tight">Your grades</h1>

        <Card className="mt-4 overflow-hidden">
          <ul className="divide-y divide-border">
            {grades.map((item) => {
              const status = item.submission?.status ?? "ASSIGNED";
              return (
                <li key={item.id}>
                  <Link
                    href={`/course/${id}/classwork/${item.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDueDate(item.dueDate)}
                      </p>
                    </div>

                    <Badge
                      variant="outline"
                      className={cn("shrink-0", SUBMISSION_TONES[status])}
                    >
                      {SUBMISSION_LABELS[status]}
                    </Badge>

                    <span className="w-20 shrink-0 text-right font-medium tabular-nums">
                      {formatGrade(item.submission?.grade, item.maxPoints)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    );
  }

  const gradebook = await getGradebook(id);

  if (gradebook.students.length === 0 || gradebook.assignments.length === 0) {
    return (
      <div className="container-page py-6">
        <EmptyState
          icon={GraduationCap}
          title="Nothing to grade yet"
          description={
            gradebook.students.length === 0
              ? "Once students join the class, their grades will appear here."
              : "Post some graded classwork and the gradebook will fill in."
          }
        />
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <h1 className="mb-4 text-xl font-semibold tracking-tight">Gradebook</h1>
      <GradebookTable
        courseId={id}
        courseName={course.name}
        students={gradebook.students}
        assignments={gradebook.assignments}
        cells={gradebook.cells}
      />
    </div>
  );
}
