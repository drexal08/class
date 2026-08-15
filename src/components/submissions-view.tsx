"use client";

import { useState, useActionState } from "react";
import {
  gradeSubmissionAction,
  returnSubmissionAction,
  type ActionState,
} from "@/lib/actions/assignment-actions";
import { Avatar } from "./avatar";
import { formatDateTime } from "@/lib/utils";
import { CommentSection } from "./comment-section";

type Submission = {
  id: number;
  status: "assigned" | "turned_in" | "graded" | "returned";
  content: string | null;
  grade: number | null;
  feedback: string | null;
  turnedInAt: Date | null;
  gradedAt: Date | null;
  late: boolean;
  studentId: number;
  studentName: string;
  studentEmail: string;
  studentColor: string;
};

type Props = {
  submissions: Submission[];
  maxPoints: number | null;
  courseId: number;
  assignmentId: number;
  themeColor: string;
};

export function SubmissionsView({
  submissions,
  maxPoints,
  courseId,
  assignmentId,
  themeColor,
}: Props) {
  const [selected, setSelected] = useState<Submission | null>(
    submissions.length > 0 ? submissions[0] : null
  );

  const statusColors: Record<string, string> = {
    assigned: "text-gray-500",
    turned_in: "text-green-600",
    graded: "text-blue-600",
    returned: "text-orange-600",
  };

  const statusLabels: Record<string, string> = {
    assigned: "Not submitted",
    turned_in: "Turned in",
    graded: "Graded",
    returned: "Returned",
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Student List */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="p-3 bg-gray-50 border-b border-gray-200">
          <p className="text-sm font-medium text-gray-700">
            {submissions.length} student{submissions.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
          {submissions.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSelected(sub)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 cursor-pointer transition ${
                selected?.id === sub.id ? "bg-blue-50" : ""
              }`}
            >
              <Avatar
                name={sub.studentName}
                color={sub.studentColor}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {sub.studentName}
                </p>
                <p
                  className={`text-xs ${statusColors[sub.status]}`}
                >
                  {statusLabels[sub.status]}
                  {sub.late && " · Late"}
                </p>
              </div>
              {sub.grade !== null && (
                <span className="text-sm font-medium text-gray-900">
                  {sub.grade}
                  {maxPoints !== null && (
                    <span className="text-gray-400">/{maxPoints}</span>
                  )}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Submission Detail */}
      <div className="lg:col-span-2 space-y-4">
        {selected ? (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Avatar
                  name={selected.studentName}
                  color={selected.studentColor}
                  size="lg"
                />
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {selected.studentName}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {selected.studentEmail}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    selected.status === "turned_in"
                      ? "bg-green-100 text-green-700"
                      : selected.status === "graded"
                      ? "bg-blue-100 text-blue-700"
                      : selected.status === "returned"
                      ? "bg-orange-100 text-orange-700"
                      : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {statusLabels[selected.status]}
                </span>
                {selected.late && (
                  <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                    Late
                  </span>
                )}
                {selected.turnedInAt && (
                  <span className="text-xs text-gray-400">
                    Submitted {formatDateTime(selected.turnedInAt)}
                  </span>
                )}
              </div>

              {/* Student's Work */}
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  Student&apos;s work
                </h3>
                {selected.content ? (
                  <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-700 whitespace-pre-wrap">
                    {selected.content}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 italic">
                    No work submitted
                  </p>
                )}
              </div>
            </div>

            {/* Grade Form */}
            {(selected.status === "turned_in" ||
              selected.status === "graded" ||
              selected.status === "returned") && (
              <GradeForm
                submissionId={selected.id}
                currentGrade={selected.grade}
                currentFeedback={selected.feedback}
                maxPoints={maxPoints}
                themeColor={themeColor}
                status={selected.status}
              />
            )}

            {/* Private Comments */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">
                Private comments
              </h3>
              <CommentSection
                submissionId={selected.id}
                courseId={courseId}
              />
            </div>
          </>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <p className="text-sm">Select a student to view their submission</p>
          </div>
        )}
      </div>
    </div>
  );
}

function GradeForm({
  submissionId,
  currentGrade,
  currentFeedback,
  maxPoints,
  themeColor,
  status,
}: {
  submissionId: number;
  currentGrade: number | null;
  currentFeedback: string | null;
  maxPoints: number | null;
  themeColor: string;
  status: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    gradeSubmissionAction,
    {}
  );

  async function handleReturn() {
    await returnSubmissionAction(submissionId);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <h3 className="text-sm font-medium text-gray-700 mb-4">Grade</h3>
      {state.error && (
        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {state.error}
        </div>
      )}
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="submissionId" value={submissionId} />
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              name="grade"
              type="number"
              min="0"
              max={maxPoints ?? 1000}
              defaultValue={currentGrade ?? ""}
              required
              className="w-20 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg"
            />
            {maxPoints !== null && (
              <span className="text-gray-500">/ {maxPoints}</span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">
            Private feedback (optional)
          </label>
          <textarea
            name="feedback"
            rows={3}
            defaultValue={currentFeedback ?? ""}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
            placeholder="Add feedback for this student..."
          />
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="px-6 py-2 text-sm text-white rounded-md disabled:opacity-50 cursor-pointer"
            style={{ backgroundColor: themeColor }}
          >
            {isPending
              ? "Saving..."
              : currentGrade !== null
              ? "Update grade"
              : "Grade"}
          </button>
          {(status === "graded" || status === "returned") && (
            <button
              type="button"
              onClick={handleReturn}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 cursor-pointer"
            >
              Return
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
