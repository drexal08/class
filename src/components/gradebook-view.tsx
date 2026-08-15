"use client";

import { Avatar } from "./avatar";
import Link from "next/link";

type Student = {
  userId: number;
  name: string;
  email: string;
  avatarColor: string;
};

type AssignmentCol = {
  id: number;
  title: string;
  maxPoints: number | null;
  type: "assignment" | "quiz" | "material";
};

type Submission = {
  assignmentId: number;
  studentId: number;
  grade: number | null;
  status: "assigned" | "turned_in" | "graded" | "returned";
};

type GradebookData = {
  students: Student[];
  assignments: AssignmentCol[];
  submissions: Submission[];
} | null;

type Props = {
  data: GradebookData;
  themeColor: string;
  courseId: number;
};

export function GradebookView({ data, themeColor, courseId }: Props) {
  if (!data || data.assignments.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <p className="text-sm">
          No graded assignments yet. Create assignments to see the gradebook.
        </p>
      </div>
    );
  }

  const { students, assignments, submissions } = data;

  function getGrade(studentId: number, assignmentId: number) {
    return submissions.find(
      (s) => s.studentId === studentId && s.assignmentId === assignmentId
    );
  }

  function getOverallGrade(studentId: number): string {
    let totalEarned = 0;
    let totalPossible = 0;
    for (const a of assignments) {
      if (a.maxPoints === null || a.maxPoints === 0) continue;
      const sub = getGrade(studentId, a.id);
      if (sub?.grade !== null && sub?.grade !== undefined) {
        totalEarned += sub.grade;
        totalPossible += a.maxPoints;
      }
    }
    if (totalPossible === 0) return "—";
    return Math.round((totalEarned / totalPossible) * 100) + "%";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="sticky left-0 bg-white z-10 px-4 py-3 text-left font-medium text-gray-700 min-w-[200px] border-r border-gray-100">
              Student
            </th>
            {assignments.map((a) => (
              <th
                key={a.id}
                className="px-4 py-3 text-center font-medium text-gray-700 min-w-[120px]"
              >
                <Link
                  href={`/course/${courseId}/assignment/${a.id}`}
                  className="hover:underline block truncate max-w-[120px]"
                  style={{ color: themeColor }}
                >
                  {a.title}
                </Link>
                {a.maxPoints !== null && (
                  <span className="text-xs text-gray-400 font-normal block">
                    out of {a.maxPoints}
                  </span>
                )}
              </th>
            ))}
            <th className="px-4 py-3 text-center font-medium text-gray-700 min-w-[100px] border-l border-gray-100">
              Overall
            </th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr>
              <td
                colSpan={assignments.length + 2}
                className="px-4 py-8 text-center text-gray-400"
              >
                No students enrolled
              </td>
            </tr>
          ) : (
            students.map((student) => (
              <tr
                key={student.userId}
                className="border-b border-gray-100 hover:bg-gray-50"
              >
                <td className="sticky left-0 bg-white z-10 px-4 py-3 border-r border-gray-100">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={student.name}
                      color={student.avatarColor}
                      size="sm"
                    />
                    <span className="text-sm text-gray-900 truncate">
                      {student.name}
                    </span>
                  </div>
                </td>
                {assignments.map((a) => {
                  const sub = getGrade(student.userId, a.id);
                  return (
                    <td
                      key={a.id}
                      className="px-4 py-3 text-center"
                    >
                      {sub?.grade !== null && sub?.grade !== undefined ? (
                        <span className="font-medium text-gray-900">
                          {sub.grade}
                        </span>
                      ) : sub?.status === "turned_in" ? (
                        <Link
                          href={`/course/${courseId}/assignment/${a.id}/submissions`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Turned in
                        </Link>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-center font-medium border-l border-gray-100">
                  <span
                    style={{ color: themeColor }}
                  >
                    {getOverallGrade(student.userId)}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
