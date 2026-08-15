import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCourseById } from "@/lib/actions/course-actions";
import { getAnnouncements } from "@/lib/actions/stream-actions";
import { StreamView } from "@/components/stream-view";

export default async function CourseStreamPage({
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

  const anns = await getAnnouncements(courseId);

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      {/* Hero Banner */}
      <div
        className="rounded-lg p-6 mb-6 text-white relative overflow-hidden"
        style={{ backgroundColor: course.themeColor }}
      >
        <h1 className="text-3xl font-medium">{course.name}</h1>
        {course.section && (
          <p className="text-white/80 mt-1">{course.section}</p>
        )}
        {course.userRole === "teacher" && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs bg-white/20 px-3 py-1 rounded-full">
              Class code: {course.joinCode}
            </span>
          </div>
        )}
      </div>

      <StreamView
        courseId={courseId}
        announcements={anns}
        userRole={course.userRole}
        themeColor={course.themeColor}
      />
    </main>
  );
}
