import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCourseById } from "@/lib/actions/course-actions";
import { getGradebookData } from "@/lib/actions/assignment-actions";
import { GradebookView } from "@/components/gradebook-view";

export default async function GradesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const courseId = parseInt(id, 10);
  const course = await getCourseById(courseId);
  if (!course || course.userRole !== "teacher") redirect("/dashboard");

  const data = await getGradebookData(courseId);

  return (
    <main className="max-w-full mx-auto px-4 md:px-6 py-6">
      <GradebookView data={data} themeColor={course.themeColor} courseId={courseId} />
    </main>
  );
}
