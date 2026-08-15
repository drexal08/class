import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import {
  getAssignmentById,
  getStudentSubmission,
  getAssignmentSubmissions,
} from "@/lib/actions/assignment-actions";
import { formatDate, formatDateTime, isOverdue } from "@/lib/utils";
import { SubmitWorkForm } from "@/components/submit-work-form";
import { CommentSection } from "@/components/comment-section";
import Link from "next/link";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id, assignmentId } = await params;
  const courseId = parseInt(id, 10);
  const aId = parseInt(assignmentId, 10);

  const assignment = await getAssignmentById(aId);
  if (!assignment || assignment.courseId !== courseId) redirect(`/course/${courseId}/classwork`);

  const isTeacher = assignment.userRole === "teacher";
  const studentSubmission = !isTeacher
    ? await getStudentSubmission(aId, user.id)
    : null;
  const allSubmissions = isTeacher
    ? await getAssignmentSubmissions(aId)
    : [];

  const overdue = isOverdue(assignment.dueDate);
  const turnedInCount = allSubmissions.filter(
    (s) => s.status !== "assigned"
  ).length;
  const gradedCount = allSubmissions.filter(
    (s) => s.status === "graded" || s.status === "returned"
  ).length;

  return (
    <main className="max-w-4xl mx-auto px-4 md:px-6 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl shrink-0">
                {assignment.type === "quiz" ? "❓" : assignment.type === "material" ? "📖" : "📝"}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-normal text-gray-900">
                  {assignment.title}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500">
                  <span>{assignment.createdByName}</span>
                  <span>·</span>
                  <span>{formatDateTime(assignment.createdAt)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                  {assignment.maxPoints !== null && (
                    <span className="text-gray-700">
                      {assignment.maxPoints} points
                    </span>
                  )}
                  {assignment.dueDate && (
                    <span className={overdue ? "text-red-500 font-medium" : "text-gray-500"}>
                      Due {formatDate(assignment.dueDate)}
                      {overdue && " (Past due)"}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {assignment.description && (
              <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-700 whitespace-pre-wrap">
                {assignment.description}
              </div>
            )}
          </div>

          {/* Class comments */}
          <div className="bg-white border border-gray-200 rounded-lg mt-4 p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Class comments
            </h3>
            <CommentSection
              assignmentId={assignment.id}
              courseId={courseId}
            />
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Teacher View: Submission Summary */}
          {isTeacher && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-2xl font-medium text-green-600">
                    {turnedInCount}
                  </p>
                  <p className="text-xs text-gray-500">Turned in</p>
                </div>
                <div>
                  <p className="text-2xl font-medium text-blue-600">
                    {gradedCount}
                  </p>
                  <p className="text-xs text-gray-500">Graded</p>
                </div>
              </div>
              <Link
                href={`/course/${courseId}/assignment/${assignment.id}/submissions`}
                className="block mt-4 w-full text-center py-2 text-sm text-blue-600 border border-blue-200 rounded-md hover:bg-blue-50 transition"
              >
                View all submissions
              </Link>
            </div>
          )}

          {/* Student View: Your Work */}
          {!isTeacher && assignment.type !== "material" && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Your work
              </h3>
              {studentSubmission && studentSubmission.status !== "assigned" ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        studentSubmission.status === "turned_in"
                          ? "bg-green-100 text-green-700"
                          : studentSubmission.status === "graded"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {studentSubmission.status === "turned_in"
                        ? "Turned in"
                        : studentSubmission.status === "graded"
                        ? "Graded"
                        : "Returned"}
                    </span>
                    {studentSubmission.late && (
                      <span className="text-xs text-red-500">Done late</span>
                    )}
                  </div>
                  {studentSubmission.grade !== null && (
                    <p className="text-lg font-medium text-gray-900">
                      {studentSubmission.grade}
                      {assignment.maxPoints !== null &&
                        ` / ${assignment.maxPoints}`}
                    </p>
                  )}
                  {studentSubmission.feedback && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Feedback:</p>
                      {studentSubmission.feedback}
                    </div>
                  )}
                  {studentSubmission.content && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm text-gray-600">
                      <p className="text-xs text-gray-400 mb-1">Your response:</p>
                      {studentSubmission.content}
                    </div>
                  )}
                </div>
              ) : (
                <SubmitWorkForm
                  assignmentId={assignment.id}
                  courseId={courseId}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
