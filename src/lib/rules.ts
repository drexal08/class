import type {
  PostPolicy,
  Role,
  SubmissionState,
} from "@/generated/prisma/client";

/**
 * Pure authorization and workflow rules.
 *
 * These live outside the server-only modules so they can be unit-tested
 * without a database or a request context. Guards and actions call them; the
 * tests in `rules.test.ts` pin the behaviour down.
 */

export type CourseAccess = {
  role: Role;
  /** May read teacher-only surfaces. Administrators inspecting a class get this. */
  isTeacher: boolean;
  /** May mutate the class. Only an enrolled teacher of that class may. */
  canManage: boolean;
  isEnrolled: boolean;
};

/**
 * Resolves how a viewer should be treated in a course.
 *
 * An administrator is an overlay, not a third role: inside a class they are
 * whatever their enrollment says. Only when they are *not* enrolled do they get
 * read-only teacher-like access for inspection.
 */
export function resolveCourseAccess(input: {
  isAdmin: boolean;
  enrollment: { role: Role } | null;
}): CourseAccess | null {
  const { isAdmin, enrollment } = input;

  if (enrollment) {
    const isTeacher = enrollment.role === "TEACHER";
    return {
      role: enrollment.role,
      isTeacher,
      canManage: isTeacher,
      isEnrolled: true,
    };
  }

  if (isAdmin) {
    return {
      role: "TEACHER",
      isTeacher: true,
      canManage: false,
      isEnrolled: false,
    };
  }

  return null;
}

/** Teachers may always post; students only under a permissive policy. */
export function canPostOnStream(input: {
  canManage: boolean;
  role: Role;
  postPolicy: PostPolicy;
}): boolean {
  if (input.canManage) return true;
  if (input.role !== "STUDENT") return false;
  return input.postPolicy === "STUDENTS_CAN_POST_AND_COMMENT";
}

/** Teachers may always comment; students unless the class is teacher-only. */
export function canCommentOnStream(input: {
  canManage: boolean;
  role: Role;
  postPolicy: PostPolicy;
}): boolean {
  if (input.canManage) return true;
  if (input.role !== "STUDENT") return false;
  return input.postPolicy !== "ONLY_TEACHERS";
}

/**
 * A student may turn work in again only while it has not been marked. Once a
 * teacher grades or returns it, re-submitting would silently discard the grade.
 */
export function canSubmitWork(status: SubmissionState): boolean {
  return status === "ASSIGNED" || status === "SUBMITTED" || status === "LATE";
}

/**
 * Students see a mark only after the teacher explicitly returns the work.
 * A saved-but-unreturned grade is still being worked on.
 */
export function visibleGradeForStudent(
  status: SubmissionState,
  grade: number | null,
): number | null {
  return status === "RETURNED" ? grade : null;
}

export function visibleFeedbackForStudent(
  status: SubmissionState,
  feedback: string | null,
): string | null {
  return status === "RETURNED" ? feedback : null;
}

/** Object keys are always `courses/<courseId>/<scope>/<uuid>-<name>`. */
export function attachmentKeyBelongsToCourse(
  key: string,
  courseId: string,
  scope: string,
): boolean {
  return key.startsWith(`courses/${courseId}/${scope}/`);
}

export type RubricCriterion = { id: string; points: number };
export type RubricEntry = { criterionId: string; points: number };

/**
 * Validates rubric marks against the assignment's own criteria. Returns a
 * user-facing error, or `null` when every entry is valid.
 */
export function rubricScoreError(
  criteria: RubricCriterion[],
  entries: RubricEntry[],
): string | null {
  const byId = new Map(criteria.map((criterion) => [criterion.id, criterion]));

  for (const entry of entries) {
    const criterion = byId.get(entry.criterionId);
    if (!criterion) {
      return "That rubric criterion does not belong to this assignment";
    }
    if (!Number.isFinite(entry.points)) {
      return "Rubric points must be numbers";
    }
    if (entry.points < 0) {
      return "Rubric points cannot be negative";
    }
    if (entry.points > criterion.points) {
      return `Rubric points cannot be more than ${criterion.points}`;
    }
  }

  return null;
}
