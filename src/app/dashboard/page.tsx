import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getUserCourses } from "@/lib/actions/course-actions";
import { Header } from "@/components/header";
import Link from "next/link";
import { CreateCourseDialog } from "@/components/create-course-dialog";
import { JoinCourseDialog } from "@/components/join-course-dialog";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const courses = await getUserCourses();
  const activeCourses = courses.filter((c) => !c.archived);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-normal text-gray-800">
            {activeCourses.length === 0 ? "Welcome to Classroom" : "My Classes"}
          </h1>
          <div className="flex gap-2">
            {(user.role === "teacher" || user.role === "admin") && (
              <CreateCourseDialog />
            )}
            <JoinCourseDialog />
          </div>
        </div>

        {activeCourses.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h2 className="text-lg text-gray-600 mb-2">
              No classes yet
            </h2>
            <p className="text-gray-400 max-w-md mx-auto">
              {user.role === "teacher"
                ? "Create your first class to get started, or join an existing class with a code."
                : "Join a class with a code from your teacher to get started."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {activeCourses.map((course) => (
              <Link
                key={course.id}
                href={`/course/${course.id}`}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-md transition group"
              >
                <div
                  className="h-24 p-4 flex flex-col justify-end relative"
                  style={{ backgroundColor: course.themeColor }}
                >
                  <h3 className="text-white text-xl font-medium truncate">
                    {course.name}
                  </h3>
                  {course.section && (
                    <p className="text-white/80 text-sm truncate">
                      {course.section}
                    </p>
                  )}
                </div>
                <div className="p-4 h-28 border-b border-gray-100">
                  {course.enrollmentRole === "student" && (
                    <p className="text-sm text-gray-500">
                      {course.creatorName}
                    </p>
                  )}
                  {course.subject && (
                    <p className="text-sm text-gray-400 mt-1">{course.subject}</p>
                  )}
                </div>
                <div className="px-4 py-3 flex justify-end">
                  <span className="text-xs text-gray-400 capitalize">
                    {course.enrollmentRole}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
