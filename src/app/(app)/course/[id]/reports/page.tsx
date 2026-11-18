import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportCommentForm } from "@/components/school/report-comment-form";
import { TermSelector } from "@/components/school/term-selector";
import { Card } from "@/components/ui/card";
import { getCourseForUser } from "@/lib/data/courses";
import { getCourseReports } from "@/lib/data/school";
import { displayNameOf } from "@/lib/utils";

export const metadata: Metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export default async function CourseReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ term?: string }>;
}) {
  const { id } = await params;
  const { term: termId } = await searchParams;

  const course = await getCourseForUser(id);
  if (!course || !course.isTeacher) notFound();

  const reports = await getCourseReports(id, termId);

  return (
    <div className="container-feed space-y-5 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">Reports</h2>
        {reports.classAverage !== null && (
          <p className="text-sm text-muted-foreground">
            Class average{" "}
            <span className="font-medium text-foreground tabular-nums">
              {reports.classAverage}%
            </span>
          </p>
        )}
      </div>

      <TermSelector
        terms={reports.terms}
        currentId={reports.term?.id ?? null}
        basePath={`/course/${id}/reports`}
      />

      {reports.term === null ? (
        <p className="text-sm text-muted-foreground">
          An administrator needs to create a term first.
        </p>
      ) : reports.rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nobody is enrolled in this class yet.
        </p>
      ) : (
        <div className="space-y-4">
          {reports.rows.map((row) => (
            <Card key={row.student.id} className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold tracking-tight">
                  {displayNameOf(row.student)}
                </h3>
                <p className="text-sm tabular-nums">
                  <span className="font-semibold">
                    {row.result.average === null ? "—" : `${row.result.average}%`}
                  </span>{" "}
                  <span className="text-muted-foreground">average</span>
                  <span className="mx-2 text-border">|</span>
                  <span className="font-semibold">
                    {row.attendanceRate === null ? "—" : `${row.attendanceRate}%`}
                  </span>{" "}
                  <span className="text-muted-foreground">attendance</span>
                </p>
              </div>

              {row.result.categories.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {row.result.categories.map((category) => (
                    <li
                      key={category.categoryId}
                      className="rounded-full border border-border bg-secondary px-2.5 py-1"
                    >
                      {round(category.average)}% ·{" "}
                      <span className="text-muted-foreground">
                        {round(category.effectiveWeight)}% weight
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <p className="mt-3 text-xs text-muted-foreground">
                {row.attendance.attended} present of {row.attendance.counted}{" "}
                recorded · {row.attendance.excused} excused ·{" "}
                {row.result.markedItems} of {row.result.totalItems} items marked
              </p>

              <div className="mt-3">
                <ReportCommentForm
                  courseId={id}
                  termId={reports.term.id}
                  studentId={row.student.id}
                  body={row.comment}
                />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
