import type { Metadata } from "next";
import Link from "next/link";
import { Archive, GraduationCap, TrendingUp, Clock, Award, Target, ClipboardList, MessagesSquare } from "lucide-react";

import { CourseCard } from "@/components/course/course-card";
import { CreateCourseDialog } from "@/components/course/create-course-dialog";
import { JoinCourseDialog } from "@/components/course/join-course-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { TodayStrip } from "@/components/school/today-strip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/session";
import { listUserCourses } from "@/lib/data/courses";
import {
  getStudentTermOverview,
  getTodaySchedule,
  schoolTimeZone,
} from "@/lib/data/school";
import { listAnnouncements } from "@/lib/data/stream";
import { minutesSinceMidnight } from "@/lib/school/schedule";
import { displayNameOf, accentClasses, cn, formatRelative, formatDueDate } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

// Reads cookies and per-user data, so it must never be prerendered.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const courses = await listUserCourses();

  const [today, overview, recentActivity] = await Promise.all([
    getTodaySchedule(),
    user?.role === "STUDENT" ? getStudentTermOverview() : Promise.resolve(null),
    user && courses.length > 0 ? listAnnouncements(courses[0].id) : Promise.resolve([]),
  ]);
  const minutesNow = minutesSinceMidnight(new Date(), schoolTimeZone());

  // Creating classes is a teacher thing. Administrators keep their own role
  // in the LMS, so the button follows the role and not the admin flag.
  const canCreate = user?.role === "TEACHER";
  const teaching = courses.filter((course) => course.enrollmentRole !== "STUDENT");
  const enrolled = courses.filter((course) => course.enrollmentRole === "STUDENT");

  // Calculate metrics
  const totalCourses = courses.length;
  const totalAssignments = courses.reduce((sum, c) => sum + (c._count?.assignments || 0), 0);
  const termName = overview?.term?.name;
  const termAverage = overview?.average;
  const termAttendance = overview?.attendanceRate;

  return (
    <div className="container-page py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
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
              <Archive className="mr-2 h-4 w-4" />
              Archived
            </Link>
          </Button>
          <JoinCourseDialog
            trigger={
              <Button variant="outline" size="sm">
                <Target className="mr-2 h-4 w-4" />
                Join Class
              </Button>
            }
          />
          {canCreate && (
            <CreateCourseDialog
              trigger={
                <Button size="sm">
                  <GraduationCap className="mr-2 h-4 w-4" />
                  Create Class
                </Button>
              }
            />
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <MetricCard
          title="Active Classes"
          value={totalCourses}
          icon={<GraduationCap className="h-5 w-5" />}
          trend={totalCourses > 0 ? "+1 this term" : null}
          accent="primary"
        />
        <MetricCard
          title="Total Assignments"
          value={totalAssignments}
          icon={<ClipboardList className="h-5 w-5" />}
          trend={totalAssignments > 0 ? "All courses" : null}
          accent="info"
        />
        <MetricCard
          title="Upcoming Deadlines"
          value={courses.reduce((sum, c) => sum + (c._count?.assignments || 0), 0)}
          icon={<Clock className="h-5 w-5" />}
          trend="This week"
          accent="warning"
        />
        <MetricCard
          title={termName || "Term Progress"}
          value={termAverage !== null && termAverage !== undefined ? `${termAverage}%` : "—"}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={termAttendance !== null && termAttendance !== undefined ? `${termAttendance}% attendance` : null}
          accent="success"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        {/* Main Content */}
        <div className="space-y-6 min-w-0">
          {/* Today's Schedule */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Today's Schedule
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/calendar">View Calendar</Link>
              </Button>
            </div>
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <TodayStrip slots={today} minutesNow={minutesNow} />
            </div>
          </section>

          {/* Recent Activity Feed */}
          {recentActivity.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <MessagesSquare className="h-5 w-5 text-muted-foreground" />
                  Recent Activity
                </h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/todo">View All</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((post) => (
                  <ActivityCard key={post.id} post={post} />
                ))}
              </div>
            </section>
          )}

          {/* Courses Grid */}
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
                  <JoinCourseDialog
                    trigger={
                      <Button variant="outline">
                        <Target className="mr-2 h-4 w-4" />
                        Join Class
                      </Button>
                    }
                  />
                  {canCreate && (
                    <CreateCourseDialog
                      trigger={
                        <Button>
                          <GraduationCap className="mr-2 h-4 w-4" />
                          Create Class
                        </Button>
                      }
                    />
                  )}
                </div>
              }
            />
          ) : (
            <div className="space-y-8">
              {teaching.length > 0 && (
                <CourseSection title="Teaching" courses={teaching} />
              )}
              {enrolled.length > 0 && (
                <CourseSection title="Enrolled" courses={enrolled} />
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          {/* Upcoming Deadlines */}
          <UpcomingDeadlinesSidebar courses={courses} />

          {/* Student Progress Overview */}
          {overview?.term && (
            <StudentProgressCard overview={overview} />
          )}

          {/* Quick Actions */}
          <QuickActionsCard canCreate={canCreate} />
        </aside>
      </div>
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
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
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

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  accent,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string | null;
  accent: "primary" | "success" | "warning" | "info";
}) {
  const accentStyles = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/10 text-warning",
    info: "bg-info/10 text-info",
  };

  return (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
          {trend && <p className="mt-1 text-xs text-muted-foreground">{trend}</p>}
        </div>
        <div className={cn("rounded-lg p-2", accentStyles[accent])}>
          {Icon}
        </div>
      </div>
    </Card>
  );
}

function ActivityCard({ post }: { post: { id: string; content: string; createdAt: Date; author: { displayName: string | null; email: string } } }) {
  const accent = accentClasses("slate");
  return (
    <Card className="p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", accent.rule)}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-medium truncate">{post.content.slice(0, 60)}...</h3>
            <span className="text-xs text-muted-foreground shrink-0">
              {formatRelative(post.createdAt)}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Posted by {displayNameOf(post.author)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function UpcomingDeadlinesSidebar({ courses }: { courses: Awaited<ReturnType<typeof listUserCourses>> }) {
  // For now, show a placeholder since we don't have upcoming assignments in the course summary
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/todo">All</Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-center py-6">
          <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No upcoming work</p>
          <p className="mt-1 text-xs text-muted-foreground">Assignments with due dates will appear here</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StudentProgressCard({ overview }: { overview: { term: { name: string; id: string }; average: number | null; attendanceRate: number | null } }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          {overview.term.name} Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {/* Overall Progress */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Term Average</span>
            <span className="font-semibold tabular-nums">
              {overview.average === null ? "—" : `${overview.average}%`}
            </span>
          </div>
          <Progress
            value={overview.average ?? 0}
            className="mt-2 h-2"
            max={100}
          />
        </div>

        <Separator />

        {/* Attendance */}
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Attendance</span>
            <span className="font-semibold tabular-nums">
              {overview.attendanceRate === null ? "—" : `${overview.attendanceRate}%`}
            </span>
          </div>
          <Progress
            value={overview.attendanceRate ?? 0}
            className="mt-2 h-2"
            max={100}
          />
        </div>

        <div className="pt-2">
          <Button asChild variant="outline" className="w-full" size="sm">
            <Link href={`/reports/${overview.term.id}`}>
              <Award className="mr-2 h-4 w-4" />
              View Report Card
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickActionsCard({ canCreate }: { canCreate: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {canCreate && (
          <CreateCourseDialog
            trigger={
              <Button variant="outline" className="w-full justify-start gap-3">
                <GraduationCap className="h-4 w-4" />
                Create Class
              </Button>
            }
          />
        )}
        <JoinCourseDialog
          trigger={
            <Button variant="outline" className="w-full justify-start gap-3">
              <Target className="h-4 w-4" />
              Join Class
            </Button>
          }
        />
        <Button asChild variant="outline" className="w-full justify-start gap-3">
          <Link href="/calendar">
            <Clock className="h-4 w-4" />
            View Calendar
          </Link>
        </Button>
        <Button asChild variant="outline" className="w-full justify-start gap-3">
          <Link href="/grades">
            <Award className="h-4 w-4" />
            Check Grades
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}