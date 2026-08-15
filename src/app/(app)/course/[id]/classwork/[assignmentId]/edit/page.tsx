import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { EditAssignmentForm } from "@/components/classwork/edit-assignment-form";
import { Button } from "@/components/ui/button";
import { getAssignment, listTopics } from "@/lib/data/classwork";
import { getCourseForUser } from "@/lib/data/courses";

export const metadata: Metadata = { title: "Edit classwork" };
export const dynamic = "force-dynamic";

export default async function EditAssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;

  const course = await getCourseForUser(id);
  if (!course || !course.isTeacher) notFound();

  const [assignment, topics] = await Promise.all([
    getAssignment(id, assignmentId),
    listTopics(id),
  ]);
  if (!assignment) notFound();

  return (
    <div className="container-feed py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href={`/course/${id}/classwork/${assignmentId}`}>
          <ChevronLeft />
          Back to assignment
        </Link>
      </Button>

      <h1 className="mb-6 text-xl font-semibold tracking-tight">
        Edit classwork
      </h1>

      <EditAssignmentForm
        courseId={id}
        assignment={assignment}
        topics={topics}
      />
    </div>
  );
}
