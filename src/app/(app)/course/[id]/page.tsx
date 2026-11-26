import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarClock, MessagesSquare, ClipboardList, Users, GraduationCap, CalendarCheck, FileText, Settings, Shield, BookOpen, AlertCircle, TrendingUp, ArrowRight, CalendarDays } from "lucide-react";

import { AnnouncementCard } from "@/components/stream/announcement-card";
import { AnnouncementComposer } from "@/components/stream/announcement-composer";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseForUser } from "@/lib/data/courses";
import { listAssignments } from "@/lib/data/classwork";
import { listAnnouncements } from "@/lib/data/stream";
import { listCourseMembers } from "@/lib/data/courses";
import { getCourseGradebook, getStudentCourseMarks } from "@/lib/data/school";
import { isStorageConfigured } from "@/lib/env";
import { formatDueDate, isOverdue } from "@/lib/utils";
import { displayNameOf, accentClasses, cn } from "@/lib/utils";
import type { Role } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function CoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [user, course] = await Promise.all([getCurrentUser(), getCourseForUser(id)]);
  if (!user || !course) notFound();

  // Fetch data for all tabs
  const [posts, classwork, members, gradebook, studentMarks] = await Promise.all([
    listAnnouncements(id),
    listAssignments(id),
    listCourseMembers(id),
    course.canManage ? getCourseGradebook(id) : Promise.resolve(null),
    course.viewerRole === "STUDENT" ? getStudentCourseMarks(id) : Promise.resolve(null),
  ]);

  // Module C moderation: the class post policy decides who may post or comment.
  // An administrator inspecting an unenrolled class is read-only.
  const canPost =
    course.canManage ||
    (course.viewerRole === "STUDENT" &&
      course.postPolicy === "STUDENTS_CAN_POST_AND_COMMENT");
  const canComment =
    course.canManage ||
    (course.viewerRole === "STUDENT" && course.postPolicy !== "ONLY_TEACHERS");

  const upcoming = classwork
    .filter((item) => item.dueDate && !isOverdue(item.dueDate))
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime(),
    )
    .slice(0, 5);

  const overdue = classwork
    .filter((item) => item.dueDate && isOverdue(item.dueDate))
    .slice(0, 5);

  // Role is TEACHER | STUDENT from Prisma; admin is a separate flag
  const students = members.filter((m) => m.role === "STUDENT");
  const teachers = members.filter((m) => m.role === "TEACHER");

  const accent = accentClasses(course.accent);

  return (
    <div className="container-page py-6">
      {/* Tabbed Interface */}
      <Tabs defaultValue="stream" className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-7">
          <TabsTrigger value="stream">
            <MessagesSquare className="mr-2 h-4 w-4" />
            Stream
          </TabsTrigger>
          <TabsTrigger value="classwork">
            <ClipboardList className="mr-2 h-4 w-4" />
            Classwork
          </TabsTrigger>
          <TabsTrigger value="people">
            <Users className="mr-2 h-4 w-4" />
            People
          </TabsTrigger>
          <TabsTrigger value="grades">
            <GraduationCap className="mr-2 h-4 w-4" />
            Grades
          </TabsTrigger>
          {course.canManage && (
            <>
              <TabsTrigger value="attendance">
                <CalendarCheck className="mr-2 h-4 w-4" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="reports">
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Stream Tab */}
        <TabsContent value="stream" className="mt-6 space-y-4">
          {course.description && (
            <Card className="p-5 border-l-4" style={{ borderLeftColor: accent.rule.replace("bg-", "") }}>
              <h2 className="text-lg font-semibold tracking-tight">About this class</h2>
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                {course.description}
              </p>
            </Card>
          )}

          {canPost && !course.archived && (
            <AnnouncementComposer courseId={course.id} user={user} />
          )}

          {posts.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="Nothing on the stream yet"
              description={
                course.canManage
                  ? "Post an announcement to welcome your class and set expectations."
                  : "Announcements from your teacher will appear here."
              }
            />
          ) : (
            <ul className="space-y-4">
              {posts.map((post) => (
                <li key={post.id}>
                  <AnnouncementCard
                    post={post}
                    courseId={course.id}
                    viewerId={user.id}
                    canManage={course.canManage}
                    canComment={canComment && !course.archived}
                    uploadsEnabled={isStorageConfigured()}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        {/* Classwork Tab */}
        <TabsContent value="classwork" className="mt-6 space-y-6">
          {/* Upcoming Assignments */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
                Upcoming
                {upcoming.length > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {upcoming.length}
                  </Badge>
                )}
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/course/${course.id}/classwork`}>View all</Link>
              </Button>
            </div>
            {upcoming.length === 0 ? (
              <Card className="p-8 text-center">
                <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No upcoming work</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((item) => (
                  <AssignmentCard key={item.id} item={item} courseId={course.id} />
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* Overdue Assignments */}
          {overdue.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold tracking-tight flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  Overdue
                  <Badge variant="danger" className="text-xs">{overdue.length}</Badge>
                </h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href={`/course/${course.id}/classwork`}>View all</Link>
                </Button>
              </div>
              <div className="space-y-3">
                {overdue.map((item) => (
                  <AssignmentCard key={item.id} item={item} courseId={course.id} isOverdue />
                ))}
              </div>
            </section>
          )}

          <Separator />

          {/* All Classwork Link */}
          <div className="text-center">
            <Button asChild variant="outline">
              <Link href={`/course/${course.id}/classwork`}>
                View all classwork
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </TabsContent>

        {/* People Tab */}
        <TabsContent value="people" className="mt-6 space-y-6">
          {/* Teachers */}
          <section>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Teachers
            </h3>
            <div className="space-y-2">
              {teachers.map((member) => (
                <PersonCard key={member.id} member={member} roleLabel="Teacher" roleBadge="outline" />
              ))}
              {teachers.length === 0 && (
                <Card className="p-6 text-center">
                  <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                  <p className="mt-3 text-sm text-muted-foreground">No teachers yet</p>
                </Card>
              )}
            </div>
          </section>

          <Separator />

          {/* Students */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Students
                <Badge variant="secondary" className="ml-2 text-xs">{students.length}</Badge>
              </h3>
            </div>
            {students.length === 0 ? (
              <Card className="p-8 text-center">
                <Users className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 text-sm text-muted-foreground">No students enrolled yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Share the class code to invite students</p>
              </Card>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {students.slice(0, 20).map((member) => (
                  <PersonCard key={member.id} member={member} roleLabel="Student" roleBadge="secondary" />
                ))}
                {students.length > 20 && (
                  <Card className="p-6 text-center">
                    <p className="text-sm text-muted-foreground">
                      And {students.length - 20} more students
                    </p>
                    <Button asChild variant="outline" className="mt-3">
                      <Link href={`/course/${course.id}/people`}>View all</Link>
                    </Button>
                  </Card>
                )}
              </div>
            )}
          </section>
        </TabsContent>

        {/* Grades Tab */}
        <TabsContent value="grades" className="mt-6 space-y-6">
          {course.viewerRole === "STUDENT" && studentMarks?.term ? (
            <StudentGradesView marks={studentMarks} courseAccent={course.accent || "slate"} />
          ) : course.canManage && gradebook ? (
            <TeacherGradesView gradebook={gradebook} courseId={course.id} />
          ) : (
            <Card className="p-8 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
              <h3 className="mt-3 font-medium">Grades not available</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {course.canManage ? "Set up grade categories and items to start grading." : "Grades will appear here when your teacher publishes them."}
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Attendance Tab (Teacher only) */}
        {course.canManage && (
          <TabsContent value="attendance" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5" />
                  Attendance
                </CardTitle>
                <p className="text-sm text-muted-foreground">Take attendance and view reports</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                    <Link href={`/course/${course.id}/attendance`}>
                      <CalendarDays className="h-8 w-8" />
                      <span>Take Attendance</span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                    <Link href={`/course/${course.id}/attendance?view=report`}>
                      <FileText className="h-8 w-8" />
                      <span>Attendance Report</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Reports Tab (Teacher only) */}
        {course.canManage && (
          <TabsContent value="reports" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Reports
                </CardTitle>
                <p className="text-sm text-muted-foreground">Generate and view class reports</p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                    <Link href={`/course/${course.id}/reports`}>
                      <FileText className="h-8 w-8" />
                      <span>Report Cards</span>
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-24 flex flex-col items-center justify-center gap-2">
                    <Link href={`/course/${course.id}/reports?view=progress`}>
                      <TrendingUp className="h-8 w-8" />
                      <span>Progress Reports</span>
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* Settings Tab (Teacher only) */}
        {course.canManage && (
          <TabsContent value="settings" className="mt-6">
            <Button asChild variant="outline">
              <Link href={`/course/${course.id}/settings`}>
                <Settings className="mr-2 h-4 w-4" />
                Open Course Settings
              </Link>
            </Button>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

interface AssignmentItem {
  id: string;
  title: string;
  dueDate: Date | null;
  type: string;
  maxPoints: number;
  mySubmission: { status: string } | null;
}

function AssignmentCard({ item, courseId, isOverdue }: { item: AssignmentItem; courseId: string; isOverdue?: boolean }) {
  const accent = accentClasses("slate");
  const status = item.mySubmission?.status || "PENDING";
  return (
    <Card className={cn("p-4 transition-shadow hover:shadow-sm", isOverdue && "border-destructive/20 bg-destructive/5")}>
      <div className="flex items-start gap-3">
        <span
          className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", isOverdue ? "bg-destructive" : accent.rule)}
          aria-hidden
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className={cn("font-medium truncate", isOverdue && "text-destructive")}>
              <Link href={`/course/${courseId}/classwork/${item.id}`} className="hover:underline">
                {item.title}
              </Link>
            </h3>
            <span className="text-xs text-muted-foreground shrink-0">
              {item.dueDate ? formatDueDate(item.dueDate) : "No due date"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-secondary text-secondary-foreground capitalize">
                {item.type.toLowerCase().replace("_", " ")}
              </span>
            </span>
            {item.maxPoints && (
              <span>{item.maxPoints} pts</span>
            )}
            {isOverdue && (
              <Badge variant="danger" className="text-[10px]">Overdue</Badge>
            )}
            <Badge variant="outline" className="text-[10px] capitalize">{status.toLowerCase()}</Badge>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface CourseMember {
  id: string;
  role: Role;
  muted: boolean;
  createdAt: Date;
  user: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
}

function PersonCard({ member, roleLabel, roleBadge }: { member: CourseMember; roleLabel: string; roleBadge: "default" | "outline" | "secondary" }) {
  const accent = accentClasses(member.user?.email || "slate");
  return (
    <Card className="p-3 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-3">
        <div
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-full font-medium", accent.avatar)}
        >
          {member.user?.displayName?.[0]?.toUpperCase() || member.user?.email?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{displayNameOf(member.user || {})}</p>
          <p className="text-xs text-muted-foreground truncate">{member.user?.email || ""}</p>
        </div>
        <Badge variant={roleBadge} className="text-xs">{roleLabel}</Badge>
      </div>
    </Card>
  );
}

// Use the actual return types from the data functions
type StudentCourseMarks = Awaited<ReturnType<typeof getStudentCourseMarks>>;
type CourseGradebook = Awaited<ReturnType<typeof getCourseGradebook>>;

function StudentGradesView({ marks, courseAccent }: { marks: NonNullable<StudentCourseMarks>; courseAccent: string }) {
  const accent = accentClasses(courseAccent);
  
  return (
    <div className="space-y-6">
      {/* Overall Grade */}
      <Card className="p-5 border-l-4" style={{ borderLeftColor: accent.rule.replace("bg-", "") }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Overall Grade</h3>
            <p className="text-sm text-muted-foreground">
              {marks.result?.markedItems ?? 0} of {marks.result?.totalItems ?? 0} items graded
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums">
              {marks.result?.average === null ? "—" : `${marks.result?.average}%`}
            </p>
          </div>
        </div>
        <Progress
          value={marks.result?.average ?? 0}
          className="mt-4 h-2"
          max={100}
        />
      </Card>

      {/* Category Breakdown */}
      {marks.result?.categories && marks.result.categories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {marks.result.categories.map((cat) => (
              <div key={cat.categoryId} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{cat.categoryId} <span className="font-normal text-muted-foreground">({cat.weight}%)</span></span>
                  <span className="font-semibold tabular-nums">
                    {cat.average === null ? "—" : `${cat.average}%`}
                  </span>
                </div>
                <Progress value={cat.average ?? 0} className="h-1.5" max={100} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Assignments */}
      <Card>
        <CardHeader>
          <CardTitle>All Assignments</CardTitle>
        </CardHeader>
        <CardContent>
          {marks.rows.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">No graded work yet</p>
          ) : (
            <div className="space-y-3">
              {marks.rows.map((row: { id: string; title: string; categoryName: string; maximum: number; score: number | null; assessedOn: Date | null; percentage: number | null }) => (
                <div key={row.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{row.title}</p>
                    <p className="text-xs text-muted-foreground">{row.categoryName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {row.percentage === null ? "—" : `${row.percentage}%`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.score !== null ? `${row.score} / ${row.maximum}` : "Not graded"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TeacherGradesView({ gradebook, courseId }: { gradebook: NonNullable<CourseGradebook>; courseId: string }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Gradebook Overview</CardTitle>
          <p className="text-sm text-muted-foreground">
            {gradebook.students.length} students · {gradebook.items.length} assignments · {gradebook.categories.length} categories
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatBox title="Students" value={gradebook.students.length} icon={<Users className="h-5 w-5" />} />
            <StatBox title="Assignments" value={gradebook.items.length} icon={<ClipboardList className="h-5 w-5" />} />
            <StatBox title="Categories" value={gradebook.categories.length} icon={<BookOpen className="h-5 w-5" />} />
          </div>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button asChild variant="outline">
          <Link href={`/course/${courseId}/grades`}>
            Open Full Gradebook
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}

function StatBox({ title, value, icon: Icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="p-4 text-center">
      <div className="text-muted-foreground mb-1">{Icon}</div>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-xs text-muted-foreground">{title}</p>
    </Card>
  );
}