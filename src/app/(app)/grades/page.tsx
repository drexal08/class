import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { MarksTable } from "@/components/school/marks-table";
import { TermSelector } from "@/components/school/term-selector";
import { Card } from "@/components/ui/card";
import { listTerms, pickTerm, getStudentReportCard } from "@/lib/data/school";
import { meanOfAverages } from "@/lib/school/grading";
import { accentClasses, cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Grades" };
export const dynamic = "force-dynamic";

export default async function StudentGradesPage({
  searchParams,
}: {
  searchParams: Promise<{ term?: string }>;
}) {
  const { term: termId } = await searchParams;

  const terms = await listTerms();
  const term = pickTerm(terms, termId);

  if (!term) {
    return (
      <div className="container-feed py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Grades</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          No term has been set up yet.
        </p>
      </div>
    );
  }

  const report = await getStudentReportCard(term.id);
  const courses = report?.courses ?? [];

  const overall = meanOfAverages(courses.map((course) => course.result.average));

  const attended = courses.reduce(
    (sum, course) => sum + course.attendance.attended,
    0,
  );
  const counted = courses.reduce(
    (sum, course) => sum + course.attendance.counted,
    0,
  );
  const attendanceRate =
    counted === 0 ? null : Math.round((attended / counted) * 1000) / 10;

  return (
    <div className="container-feed space-y-5 py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Grades</h1>
        <div className="flex gap-5 text-sm">
          <span className="text-muted-foreground">
            Term average{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {overall === null ? "—" : `${overall}%`}
            </span>
          </span>
          <span className="text-muted-foreground">
            Attendance{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {attendanceRate === null ? "—" : `${attendanceRate}%`}
            </span>
          </span>
        </div>
      </div>

      <TermSelector terms={terms} currentId={term.id} basePath="/grades" />

      {courses.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <GraduationCap
            className="size-8 text-muted-foreground"
            strokeWidth={1.5}
            aria-hidden
          />
          <p className="font-medium">Nothing to show yet</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Join a class and your marks will appear here as your teachers enter
            them.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {courses.map((course) => (
            <section key={course.courseId}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <span
                    className={cn(
                      "h-4 w-1 rounded-full",
                      accentClasses(course.accent).rule,
                    )}
                    aria-hidden
                  />
                  <Link
                    href={`/course/${course.courseId}/grades`}
                    className="underline-offset-4 hover:underline"
                  >
                    {course.courseName}
                  </Link>
                </h2>
                <p className="text-sm text-muted-foreground">
                  {course.attendanceRate === null
                    ? "Attendance not recorded"
                    : `${course.attendanceRate}% attendance`}
                </p>
              </div>
              <MarksTable rows={course.rows} result={course.result} />
            </section>
          ))}
        </div>
      )}

      <p className="text-sm">
        <Link
          href={`/reports/${term.id}`}
          className="underline underline-offset-4"
        >
          Open the printable report card for {term.name}
        </Link>
      </p>
    </div>
  );
}
