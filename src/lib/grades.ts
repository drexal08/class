import type { SubmissionState } from "@/generated/prisma/client";

export type GradeCell = {
  assignmentId: string;
  studentId: string;
  grade: number | null;
  state: SubmissionState;
};

export type GradeableAssignment = {
  id: string;
  maxPoints: number;
};

/**
 * Index submissions by `assignmentId:studentId`.
 *
 * The gradebook renders students × assignments, so a linear `.find()` per cell
 * makes rendering quadratic. One pass into a Map keeps lookups constant.
 */
export function indexSubmissions(cells: GradeCell[]): Map<string, GradeCell> {
  const index = new Map<string, GradeCell>();
  for (const cell of cells) {
    index.set(cellKey(cell.assignmentId, cell.studentId), cell);
  }
  return index;
}

export function cellKey(assignmentId: string, studentId: string): string {
  return `${assignmentId}:${studentId}`;
}

/**
 * Overall percentage across everything actually graded.
 *
 * Ungraded work is excluded rather than counted as zero — a student's average
 * should not collapse because the teacher hasn't marked the latest task yet.
 */
export function overallPercentage(
  studentId: string,
  assignments: GradeableAssignment[],
  index: Map<string, GradeCell>,
): number | null {
  let earned = 0;
  let possible = 0;

  for (const assignment of assignments) {
    if (assignment.maxPoints <= 0) continue;

    const cell = index.get(cellKey(assignment.id, studentId));
    if (!cell || cell.grade === null) continue;

    earned += cell.grade;
    possible += assignment.maxPoints;
  }

  if (possible === 0) return null;
  return Math.round((earned / possible) * 100);
}

export function formatPercentage(value: number | null): string {
  return value === null ? "—" : `${value}%`;
}

/** Formats a grade as it appears next to an assignment: "18/20" or "—". */
export function formatGrade(
  grade: number | null | undefined,
  maxPoints: number,
): string {
  if (grade === null || grade === undefined) return "—";
  return `${roundGrade(grade)}/${maxPoints}`;
}

/** Trims floating-point noise while keeping half marks. */
export function roundGrade(grade: number): number {
  return Math.round(grade * 100) / 100;
}

/** Class average for one assignment, across graded submissions only. */
export function assignmentAverage(
  assignmentId: string,
  studentIds: string[],
  index: Map<string, GradeCell>,
): number | null {
  let total = 0;
  let count = 0;

  for (const studentId of studentIds) {
    const cell = index.get(cellKey(assignmentId, studentId));
    if (cell?.grade === null || cell?.grade === undefined) continue;
    total += cell.grade;
    count += 1;
  }

  return count === 0 ? null : Math.round((total / count) * 10) / 10;
}
