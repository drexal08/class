import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { AttendanceRegister } from "@/components/school/attendance-register";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCourseForUser } from "@/lib/data/courses";
import {
  currentDateKey,
  getAttendanceRegister,
  schoolTimeZone,
} from "@/lib/data/school";
import { isValidDateKey } from "@/lib/school/attendance";

export const metadata: Metadata = { title: "Attendance" };
export const dynamic = "force-dynamic";

export default async function CourseAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; period?: string }>;
}) {
  const { id } = await params;
  const { date, period } = await searchParams;

  const course = await getCourseForUser(id);
  if (!course) notFound();

  // Students have their own cross-class attendance view.
  if (!course.isTeacher) redirect("/attendance");

  const dateKey = date && isValidDateKey(date) ? date : currentDateKey();
  const selectedPeriod = period ?? "";

  const register = await getAttendanceRegister(
    id,
    dateKey,
    selectedPeriod || undefined,
  );

  const previous = shiftDay(dateKey, -1);
  const next = shiftDay(dateKey, 1);
  const query = selectedPeriod ? `&period=${encodeURIComponent(selectedPeriod)}` : "";

  return (
    <div className="container-page space-y-6 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Attendance</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {course.name} · times shown in {schoolTimeZone()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="icon" aria-label="Previous day">
            <Link href={`/course/${id}/attendance?date=${previous}${query}`}>
              <ChevronLeft strokeWidth={1.75} />
            </Link>
          </Button>
          <Button asChild variant="outline" size="icon" aria-label="Next day">
            <Link href={`/course/${id}/attendance?date=${next}${query}`}>
              <ChevronRight strokeWidth={1.75} />
            </Link>
          </Button>
        </div>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4"
      >
        <div className="space-y-1.5">
          <label htmlFor="register-date" className="text-xs font-medium">
            Date
          </label>
          <Input
            id="register-date"
            name="date"
            type="date"
            defaultValue={dateKey}
            className="w-44"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="register-period" className="text-xs font-medium">
            Period (optional)
          </label>
          <Input
            id="register-period"
            name="period"
            defaultValue={selectedPeriod}
            placeholder="e.g. P2"
            maxLength={20}
            className="w-32"
          />
        </div>

        <Button type="submit" variant="outline">
          Open register
        </Button>

        {register.session && (
          <p className="text-xs text-muted-foreground">
            Last saved{" "}
            {new Date(register.session.markedAt).toLocaleString("en-GB", {
              dateStyle: "medium",
              timeStyle: "short",
              timeZone: schoolTimeZone(),
            })}
          </p>
        )}
      </form>

      <AttendanceRegister
        key={`${dateKey}:${selectedPeriod}`}
        courseId={id}
        dateKey={dateKey}
        period={selectedPeriod}
        topic={register.session?.topic ?? null}
        rows={register.rows}
        requests={register.requests}
      />
    </div>
  );
}

function shiftDay(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
