import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClassCode } from "@/components/course/class-code";
import { LeaveCourseButton } from "@/components/course/leave-course-button";
import { Roster } from "@/components/people/roster";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { getCourseForUser, listCourseMembers } from "@/lib/data/courses";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [course, user] = await Promise.all([
    getCourseForUser(id),
    getCurrentUser(),
  ]);
  if (!course || !user) notFound();

  const members = await listCourseMembers(id);
  const teachers = members.filter((member) => member.role !== "STUDENT");
  const students = members.filter((member) => member.role === "STUDENT");

  return (
    <div className="container-feed space-y-8 py-6">
      {course.canManage && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Invite students
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Share this code, or send the invite link.
            </p>
          </div>
          <ClassCode
            code={course.code}
            courseId={course.id}
            size="lg"
            showInviteLink
          />
        </Card>
      )}

      <Roster
        title="Teachers"
        members={teachers}
        courseId={course.id}
        canManage={course.canManage}
        ownerId={course.teacherId}
      />

      <Roster
        title="Students"
        members={students}
        courseId={course.id}
        canManage={course.canManage}
        ownerId={course.teacherId}
      />

      {course.isEnrolled && course.teacherId !== user.id && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Leave this class
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You will lose access to its stream, classwork and grades.
            </p>
          </div>
          <LeaveCourseButton courseId={course.id} />
        </Card>
      )}
    </div>
  );
}
