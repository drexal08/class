import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AbsenceRequestForm } from "@/components/school/absence-request-form";
import { AttendanceMonthGrid } from "@/components/school/attendance-month-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getStudentAbsenceRequests,
  getStudentAttendanceMonth,
} from "@/lib/data/school";
import { buildMonthMatrix } from "@/lib/school/attendance";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function StudentAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();

  const year = clampYear(Number(params.year), now.getUTCFullYear());
  const month = clampMonth(Number(params.month), now.getUTCMonth() + 1);

  const [attendance, requests] = await Promise.all([
    getStudentAttendanceMonth(year, month),
    getStudentAbsenceRequests(),
  ]);

  const matrix = buildMonthMatrix(year, month, attendance.byDay);
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };

  const monthLabel = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(
    "en-GB",
    { month: "long", year: "numeric", timeZone: "UTC" },
  );

  return (
    <div className="container-feed space-y-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Days with no dot were not recorded, which is not an absence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Previous month">
            <Link href={`/attendance?year=${previous.year}&month=${previous.month}`}>
              <ChevronLeft strokeWidth={1.75} />
            </Link>
          </Button>
          <span className="min-w-36 text-center text-sm font-medium">
            {monthLabel}
          </span>
          <Button asChild variant="outline" size="icon" aria-label="Next month">
            <Link href={`/attendance?year=${next.year}&month=${next.month}`}>
              <ChevronRight strokeWidth={1.75} />
            </Link>
          </Button>
        </div>
      </div>

      <AttendanceMonthGrid
        matrix={matrix}
        counts={attendance.counts}
        rate={attendance.rate}
      />

      {attendance.records.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold tracking-tight">This month</h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
            {attendance.records.map((record, index) => (
              <li
                key={`${record.session.date}-${record.session.course.id}-${index}`}
                className="flex items-center gap-3 px-4 py-2.5 text-sm"
              >
                <span className="w-28 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {new Date(record.session.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {record.session.course.name}
                </span>
                <span className="shrink-0 text-xs capitalize text-muted-foreground">
                  {record.status.toLowerCase().replace("_", " ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Request an absence
        </h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">
          Your teacher decides the request. An approved absence does not change
          the register automatically.
        </p>
        <Card className="p-5">
          <AbsenceRequestForm
            courses={attendance.courses.map((course) => ({
              id: course.id,
              name: course.name,
            }))}
            requests={requests}
          />
        </Card>
      </section>
    </div>
  );
}

function clampYear(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 2000 || value > 2100) return fallback;
  return value;
}

function clampMonth(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) return fallback;
  return value;
}
