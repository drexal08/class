import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ClassCode } from "@/components/course/class-code";
import { Roster } from "@/components/people/roster";
import { Card } from "@/components/ui/card";
import { getCourseForUser, listCourseMembers } from "@/lib/data/courses";

export const metadata: Metadata = { title: "People" };
export const dynamic = "force-dynamic";

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const course = await getCourseForUser(id);
  if (!course) notFound();

  const members = await listCourseMembers(id);
  const teachers = members.filter((member) => member.role !== "STUDENT");
  const students = members.filter((member) => member.role === "STUDENT");

  return (
    <div className="container-feed space-y-8 py-6">
      {course.isTeacher && (
        <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <h2 className="text-sm font-medium">Invite students</h2>
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
        canManage={course.isTeacher}
        ownerId={course.teacherId}
      />

      <Roster
        title="Students"
        members={students}
        courseId={course.id}
        canManage={course.isTeacher}
        ownerId={course.teacherId}
      />
    </div>
  );
}
