import type { getStudentReportCard } from "@/lib/data/school";
import { meanOfAverages } from "@/lib/school/grading";
import { accentClasses, cn, displayNameOf } from "@/lib/utils";

type Card = NonNullable<Awaited<ReturnType<typeof getStudentReportCard>>>;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatDay(value: Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function ReportCard({ data }: { data: Card }) {
  const overall = meanOfAverages(
    data.courses.map((course) => course.result.average),
  );
  const attendance = meanOfAnswers(
    data.courses.map((course) => course.attendanceRate),
  );

  return (
    <article className="mx-auto max-w-3xl space-y-8 print:max-w-none">
      <header className="border-b border-border pb-4">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Report card
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {displayNameOf(data.student)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.term.name} · {data.term.academicYear} ·{" "}
          {formatDay(data.term.startsOn)} – {formatDay(data.term.endsOn)}
        </p>

        <dl className="mt-4 flex flex-wrap gap-6 text-sm">
          <div>
            <dt className="text-muted-foreground">Overall average</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {overall === null ? "—" : `${overall}%`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Attendance</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {attendance === null ? "—" : `${attendance}%`}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Subjects</dt>
            <dd className="text-lg font-semibold tabular-nums">
              {data.courses.length}
            </dd>
          </div>
        </dl>
      </header>

      {data.courses.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          You are not enrolled in any class for this term.
        </p>
      ) : (
        <div className="space-y-8">
          {data.courses.map((course) => (
            <section
              key={course.courseId}
              className="break-inside-avoid rounded-lg border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
                  <span
                    className={cn(
                      "h-4 w-1 rounded-full",
                      accentClasses(course.accent).rule,
                    )}
                    aria-hidden
                  />
                  {course.courseName}
                </h2>
                <p className="text-sm">
                  <span className="font-semibold tabular-nums">
                    {course.result.average === null
                      ? "—"
                      : `${course.result.average}%`}
                  </span>{" "}
                  <span className="text-muted-foreground">term average</span>
                </p>
              </div>

              {course.result.categories.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                  {course.result.categories.map((category) => (
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

              {course.rows.length > 0 ? (
                <table className="mt-4 w-full border-collapse text-sm">
                  <caption className="sr-only">
                    {course.courseName} marks for {data.term.name}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">
                        Item
                      </th>
                      <th scope="col" className="py-2 font-medium">
                        Category
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        Score
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        %
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {course.rows.map((row) => (
                      <tr key={row.id} className="border-b border-border/60 last:border-0">
                        <th scope="row" className="py-1.5 text-left font-normal">
                          {row.title}
                        </th>
                        <td className="py-1.5 text-muted-foreground">
                          {row.categoryName}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {row.score === null
                            ? "Not marked"
                            : `${row.score} / ${row.maximum}`}
                        </td>
                        <td className="py-1.5 text-right tabular-nums">
                          {row.score === null || row.maximum <= 0
                            ? "—"
                            : `${Math.round((row.score / row.maximum) * 1000) / 10}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">
                  No marks entered for this term.
                </p>
              )}

              <dl className="mt-4 grid gap-3 border-t border-border pt-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Attendance</dt>
                  <dd className="font-medium tabular-nums">
                    {course.attendanceRate === null
                      ? "—"
                      : `${course.attendanceRate}%`}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Present</dt>
                  <dd className="font-medium tabular-nums">
                    {course.attendance.attended} of {course.attendance.counted}{" "}
                    recorded
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Excused</dt>
                  <dd className="font-medium tabular-nums">
                    {course.attendance.excused}
                  </dd>
                </div>
              </dl>

              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Teacher comment
                </p>
                <p className="mt-1 text-sm whitespace-pre-line">
                  {course.comment ?? "No comment recorded."}
                </p>
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="border-t border-border pt-4 text-xs text-muted-foreground">
        Generated from marks and registers recorded in LMS Core. Figures are
        calculated when the page is opened, so they always match the gradebook.
      </footer>
    </article>
  );
}

/** Mean of the non-null attendance rates, one decimal place. */
function meanOfAnswers(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return Math.round((present.reduce((sum, value) => sum + value, 0) / present.length) * 10) / 10;
}
