"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  assignmentAverage,
  cellKey,
  formatPercentage,
  indexSubmissions,
  overallPercentage,
  type GradeCell,
} from "@/lib/grades";
import { displayNameOf } from "@/lib/utils";

type Student = {
  id: string;
  displayName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

type AssignmentColumn = {
  id: string;
  title: string;
  maxPoints: number;
};

export function GradebookTable({
  courseId,
  courseName,
  students,
  assignments,
  cells,
}: {
  courseId: string;
  courseName: string;
  students: Student[];
  assignments: AssignmentColumn[];
  cells: GradeCell[];
}) {
  // One pass into a Map; a linear scan per cell would make this quadratic.
  const index = useMemo(() => indexSubmissions(cells), [cells]);
  const studentIds = useMemo(() => students.map((s) => s.id), [students]);

  function exportCsv() {
    const header = [
      "Student",
      "Email",
      ...assignments.map((a) => `${a.title} (${a.maxPoints})`),
      "Overall %",
    ];

    const rows = students.map((student) => [
      displayNameOf(student),
      student.email ?? "",
      ...assignments.map((assignment) => {
        const cell = index.get(cellKey(assignment.id, student.id));
        return cell?.grade ?? "";
      }),
      overallPercentage(student.id, assignments, index) ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) =>
        row
          // Quote every field and double internal quotes, so names with commas
          // survive the round trip into a spreadsheet.
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(","),
      )
      .join("\r\n");

    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${courseName.replace(/[^\w -]/g, "")} grades.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {students.length} students · {assignments.length} graded items
        </p>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download strokeWidth={1.75} />
          Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Grades for every student across all graded classwork
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium"
                >
                  Student
                </th>
                {assignments.map((assignment) => (
                  <th
                    key={assignment.id}
                    scope="col"
                    className="min-w-28 px-3 py-3 text-left font-medium"
                  >
                    <Link
                      href={`/course/${courseId}/classwork/${assignment.id}/grade`}
                      className="line-clamp-2 underline-offset-4 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      out of {assignment.maxPoints}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-right font-medium">
                  Overall
                </th>
              </tr>

              <tr className="border-b border-border bg-secondary/40 text-xs text-muted-foreground">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-secondary/40 px-4 py-2 text-left font-normal"
                >
                  Class average
                </th>
                {assignments.map((assignment) => (
                  <td key={assignment.id} className="px-3 py-2 tabular-nums">
                    {assignmentAverage(assignment.id, studentIds, index) ?? "—"}
                  </td>
                ))}
                <td className="px-4 py-2" />
              </tr>
            </thead>

            <tbody>
              {students.map((student) => (
                <tr
                  key={student.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-48 truncate bg-card px-4 py-3 text-left font-normal"
                  >
                    {displayNameOf(student)}
                  </th>

                  {assignments.map((assignment) => {
                    const cell = index.get(cellKey(assignment.id, student.id));
                    return (
                      <td
                        key={assignment.id}
                        className="px-3 py-3 tabular-nums"
                      >
                        {cell?.grade ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    );
                  })}

                  <td className="px-4 py-3 text-right font-medium tabular-nums">
                    {formatPercentage(
                      overallPercentage(student.id, assignments, index),
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
