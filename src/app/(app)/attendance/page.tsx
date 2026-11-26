import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Calendar, BarChart3, User, AlertCircle, CheckCircle, XCircle, Clock, Download } from "lucide-react";

import { AbsenceRequestForm } from "@/components/school/absence-request-form";
import { AttendanceMonthGrid } from "@/components/school/attendance-month-grid";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getStudentAbsenceRequests,
  getStudentAttendanceMonth,
} from "@/lib/data/school";
import { buildMonthMatrix, summariseAttendance, type AttendanceStatusValue } from "@/lib/school/attendance";
import { displayNameOf, accentClasses, cn, formatDate } from "@/lib/utils";

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

  // Calculate overall stats
  const totalSessions = attendance.counts.present + attendance.counts.absent + attendance.counts.late + attendance.counts.excused;
  const attendanceRate = attendance.rate;

  // Group records by course for course breakdown
  const recordsByCourse = new Map<string, typeof attendance.records>();
  for (const record of attendance.records) {
    const courseId = record.session.course.id;
    if (!recordsByCourse.has(courseId)) {
      recordsByCourse.set(courseId, []);
    }
    recordsByCourse.get(courseId)!.push(record);
  }

  // Calculate per-course stats
  const courseStats = Array.from(recordsByCourse.entries()).map(([courseId, records]) => {
    const course = attendance.courses.find(c => c.id === courseId);
    const statuses = records.map(r => r.status as AttendanceStatusValue);
    const counts = summariseAttendance(statuses);
    const rate = attendanceRate ? Math.round((counts.present + counts.late) / (counts.present + counts.absent + counts.late + counts.excused) * 1000) / 10 : null;
    return { courseId, courseName: course?.name || "Unknown", accent: course?.accent || "slate", counts, rate, records };
  }).sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));

  return (
    <div className="container-feed space-y-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            Attendance
          </h1>
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

      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Present"
          value={attendance.counts.present}
          icon={<CheckCircle className="h-5 w-5" />}
          accent="success"
          subtitle={totalSessions > 0 ? `${Math.round(attendance.counts.present / totalSessions * 1000) / 10}%` : "0%"}
        />
        <StatCard
          title="Absent"
          value={attendance.counts.absent}
          icon={<XCircle className="h-5 w-5" />}
          accent="danger"
          subtitle={totalSessions > 0 ? `${Math.round(attendance.counts.absent / totalSessions * 1000) / 10}%` : "0%"}
        />
        <StatCard
          title="Late"
          value={attendance.counts.late}
          icon={<Clock className="h-5 w-5" />}
          accent="warning"
          subtitle={totalSessions > 0 ? `${Math.round(attendance.counts.late / totalSessions * 1000) / 10}%` : "0%"}
        />
        <StatCard
          title="Excused"
          value={attendance.counts.excused}
          icon={<AlertCircle className="h-5 w-5" />}
          accent="info"
          subtitle={totalSessions > 0 ? `${Math.round(attendance.counts.excused / totalSessions * 1000) / 10}%` : "0%"}
        />
      </div>

      {/* Attendance Rate Card */}
      <Card className="p-5 border-l-4" style={{ borderLeftColor: "var(--primary)" }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Attendance Rate</h3>
            <p className="text-sm text-muted-foreground">
              {totalSessions} sessions recorded this month
            </p>
          </div>
          <div className="text-right">
            <p className="text-4xl font-semibold tabular-nums text-primary">
              {attendanceRate === null ? "—" : `${attendanceRate}%`}
            </p>
          </div>
        </div>
        <Progress
          value={attendanceRate ?? 0}
          className="mt-4 h-3"
          max={100}
        />
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">
            <Calendar className="mr-2 h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="courses">
            <BookOpen className="mr-2 h-4 w-4" />
            By Course
          </TabsTrigger>
          <TabsTrigger value="requests">
            <AlertCircle className="mr-2 h-4 w-4" />
            Absence Requests
          </TabsTrigger>
        </TabsList>

        {/* Calendar View */}
        <TabsContent value="calendar" className="mt-6">
          <AttendanceMonthGrid
            matrix={matrix}
            counts={attendance.counts}
            rate={attendance.rate}
          />

          {attendance.records.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                This Month's Records
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Date</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Course</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {attendance.records.map((record, index) => (
                          <tr key={`${record.session.date}-${record.session.course.id}-${index}`}>
                            <td className="p-4 text-sm text-muted-foreground">
                              {new Date(record.session.date).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                timeZone: "UTC",
                              })}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <span
                                  className="w-2 h-2 rounded-full"
                                  style={{ backgroundColor: getStatusColor(record.status) }}
                                />
                                <span className="font-medium">{record.session.course.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Badge variant={getStatusVariant(record.status)}>
                                {record.status.toLowerCase().replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {record.note || "—"}
                              {record.minutesLate && (
                                <span className="ml-2 text-xs text-warning">({record.minutesLate} min late)</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </TabsContent>

        {/* By Course View */}
        <TabsContent value="courses" className="mt-6">
          {courseStats.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-medium">No attendance data</h3>
              <p className="mt-1 text-sm text-muted-foreground">Attendance will appear here once your teachers start taking roll.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {courseStats.map((stat) => (
                <CourseAttendanceCard key={stat.courseId} stat={stat} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Absence Requests View */}
        <TabsContent value="requests" className="mt-6">
          <section>
            <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-muted-foreground" />
              Request an Absence
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

          {requests.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Your Requests
              </h2>
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-border bg-secondary/50">
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Course</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dates</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Reason</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Status</th>
                          <th className="text-left p-4 text-sm font-medium text-muted-foreground">Submitted</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {requests.map((request: { id: string; course: { name: string }; fromDate: Date | string; toDate: Date | string; reason: string; status: string; createdAt: Date | string }) => (
                          <tr key={request.id}>
                            <td className="p-4 font-medium">{request.course.name}</td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {formatDate(request.fromDate)} – {formatDate(request.toDate)}
                            </td>
                            <td className="p-4 text-sm max-w-xs truncate">{request.reason}</td>
                            <td className="p-4">
                              <Badge variant={getRequestStatusVariant(request.status)}>
                                {request.status}
                              </Badge>
                            </td>
                            <td className="p-4 text-sm text-muted-foreground">
                              {formatDate(request.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </section>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: IconComponent,
  accent,
  subtitle,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  accent: "primary" | "success" | "warning" | "danger" | "info";
  subtitle: string;
}) {
  const accentStyles = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    danger: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
  };

  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className={cn("rounded-lg p-2", accentStyles[accent])}>
          {IconComponent}
        </div>
      </div>
    </Card>
  );
}

interface AttendanceRecord {
  status: string;
  minutesLate: number | null;
  note: string | null;
  session: {
    date: Date;
    period: string | null;
    course: { id: string; name: string };
  };
}

function CourseAttendanceCard({ stat }: { stat: { courseId: string; courseName: string; accent: string; counts: ReturnType<typeof summariseAttendance>; rate: number | null; records: AttendanceRecord[] } }) {
  const accent = accentClasses(stat.accent);
  const total = stat.counts.present + stat.counts.absent + stat.counts.late + stat.counts.excused;

  return (
    <Card className="p-5 border-l-4 transition-shadow hover:shadow-md" style={{ borderLeftColor: accent.rule.replace("bg-", "") }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className={cn("flex size-12 shrink-0 items-center justify-center rounded-lg font-medium", accent.chip)}
          >
            {stat.courseName[0]?.toUpperCase()}
          </div>
          <div>
            <h3 className="font-semibold">{stat.courseName}</h3>
            <p className="text-sm text-muted-foreground">{total} sessions</p>
          </div>
        </div>

        <div className="flex items-center gap-6 sm:ml-auto">
          <div className="text-right">
            <p className="text-2xl font-semibold tabular-nums">
              {stat.rate === null ? "—" : `${stat.rate}%`}
            </p>
            <p className="text-xs text-muted-foreground">Attendance Rate</p>
          </div>
          <Progress value={stat.rate ?? 0} className="w-32 h-2" max={100} />
        </div>
      </div>

      <Separator className="my-4" />

      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-lg font-semibold text-success">{stat.counts.present}</p>
          <p className="text-xs text-muted-foreground">Present</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-destructive">{stat.counts.absent}</p>
          <p className="text-xs text-muted-foreground">Absent</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-warning">{stat.counts.late}</p>
          <p className="text-xs text-muted-foreground">Late</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-info">{stat.counts.excused}</p>
          <p className="text-xs text-muted-foreground">Excused</p>
        </div>
      </div>
    </Card>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "PRESENT": return "var(--success)";
    case "ABSENT": return "var(--destructive)";
    case "LATE": return "var(--warning)";
    case "EXCUSED": return "var(--info)";
    default: return "var(--muted-foreground)";
  }
}

function getStatusVariant(status: string): "default" | "success" | "danger" | "warning" | "info" | "secondary" {
  switch (status) {
    case "PRESENT": return "success";
    case "ABSENT": return "danger";
    case "LATE": return "warning";
    case "EXCUSED": return "info";
    default: return "secondary";
  }
}

function getRequestStatusVariant(status: string): "default" | "success" | "danger" | "warning" | "info" | "secondary" {
  switch (status) {
    case "APPROVED": return "success";
    case "DENIED": return "danger";
    case "PENDING": return "warning";
    default: return "secondary";
  }
}

function clampYear(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 2000 || value > 2100) return fallback;
  return value;
}

function clampMonth(value: number, fallback: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) return fallback;
  return value;
}

import { BookOpen } from "lucide-react";