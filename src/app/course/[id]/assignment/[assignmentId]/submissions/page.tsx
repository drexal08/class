import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAssignmentById,
  getAssignmentSubmissions,
} from "@/lib/actions/assignment-actions";
import { getCourseById } from "@/lib/actions/course-actions";
import { SubmissionsView } from "@/components/submissions-view";

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id, assignmentId } = await params;
  const courseId = parseInt(id, 10);
  const aId = parseInt(assignmentId, 10);

  const course = await getCourseById(courseId);
  if (!course || course.userRole !== "teacher") redirect("/dashboard");

  const assignment = await getAssignmentById(aId);
  if (!assignment || assignment.courseId !== courseId) redirect(`/course/${courseId}/classwork`);

  const subs = await getAssignmentSubmissions(aId);

  return (
    <main className="max-w-5xl mx-auto px-4 md:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-normal text-gray-900">
          {assignment.title}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {assignment.maxPoints !== null
            ? `${assignment.maxPoints} points`
            : "Ungraded"}
        </p>
      </div>

      <SubmissionsView
        submissions={subs}
        maxPoints={assignment.maxPoints}
        courseId={courseId}
        assignmentId={aId}
        themeColor={course.themeColor}
      />
    </main>
  );
}
