import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCourseById } from "@/lib/actions/course-actions";
import {
  getCourseAssignments,
  getCourseTopics,
} from "@/lib/actions/assignment-actions";
import { ClassworkView } from "@/components/classwork-view";

export default async function ClassworkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const courseId = parseInt(id, 10);
  const course = await getCourseById(courseId);
  if (!course) redirect("/dashboard");

  const [assignmentsList, topicsList] = await Promise.all([
    getCourseAssignments(courseId),
    getCourseTopics(courseId),
  ]);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      <ClassworkView
        courseId={courseId}
        assignments={assignmentsList}
        topics={topicsList}
        userRole={course.userRole}
        themeColor={course.themeColor}
      />
    </main>
  );
}
