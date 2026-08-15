import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getCourseById, getCourseMembers } from "@/lib/actions/course-actions";
import { Avatar } from "@/components/avatar";

export default async function PeoplePage({
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

  const members = await getCourseMembers(courseId);
  const teachers = members.filter((m) => m.role === "teacher");
  const students = members.filter((m) => m.role === "student");

  return (
    <main className="max-w-3xl mx-auto px-4 md:px-6 py-6">
      {/* Teachers */}
      <div className="mb-8">
        <h2
          className="text-2xl font-normal pb-2 border-b-2 mb-4"
          style={{ color: course.themeColor, borderColor: course.themeColor }}
        >
          Teachers
        </h2>
        {teachers.map((t) => (
          <div
            key={t.userId}
            className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
          >
            <Avatar name={t.name} color={t.avatarColor} size="md" />
            <div>
              <p className="text-sm font-medium text-gray-900">{t.name}</p>
              <p className="text-xs text-gray-400">{t.email}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Students */}
      <div>
        <div className="flex items-center justify-between pb-2 border-b-2 mb-4" style={{ borderColor: course.themeColor }}>
          <h2
            className="text-2xl font-normal"
            style={{ color: course.themeColor }}
          >
            Students
          </h2>
          <span className="text-sm text-gray-500">
            {students.length} student{students.length !== 1 ? "s" : ""}
          </span>
        </div>
        {students.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No students have joined yet
          </p>
        ) : (
          students.map((s) => (
            <div
              key={s.userId}
              className="flex items-center gap-3 py-3 border-b border-gray-100 last:border-0"
            >
              <Avatar name={s.name} color={s.avatarColor} size="md" />
              <div>
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                <p className="text-xs text-gray-400">{s.email}</p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Join Code for teachers */}
      {course.userRole === "teacher" && (
        <div className="mt-8 p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Invite students with class code:</p>
          <p className="text-2xl font-mono tracking-widest" style={{ color: course.themeColor }}>
            {course.joinCode}
          </p>
        </div>
      )}
    </main>
  );
}
