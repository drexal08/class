import "server-only";

import { cache } from "react";

import { getCurrentUser } from "@/lib/auth/session";
import { ClaimRequiredError } from "@/lib/auth/claim";
import { prisma } from "@/lib/prisma";
import {
  canCommentOnStream,
  canPostOnStream,
  resolveCourseAccess,
} from "@/lib/rules";
import { requireSchoolAdmin as requireSchoolAdminImpl } from "@/lib/sdms/access";
import type { ActionState, SessionUser } from "@/lib/types";
import type { PostPolicy, Role } from "@/generated/prisma/client";

export { requireSchoolAdminImpl as requireSchoolAdmin };

/**
 * Authorization failures carry a message safe to show a user. Anything else
 * that escapes an action is logged and reported generically.
 */
export class AuthError extends Error {
  constructor(message = "You do not have permission to do that") {
    super(message);
    this.name = "AuthError";
  }
}

export type CourseContext = {
  user: SessionUser;
  courseId: string;
  courseName: string;
  /** The class owner, for targeted notifications. */
  teacherId: string;
  schoolId: string | null;
  cohortId: string | null;
  role: Role;
  /** May read teacher-only surfaces. */
  isTeacher: boolean;
  /** May mutate the class. */
  canManage: boolean;
  isEnrolled: boolean;
  archived: boolean;
  postPolicy: PostPolicy;
  muted: boolean;
};

export async function requireUser(options?: {
  allowUnclaimed?: boolean;
}): Promise<SessionUser> {
  const user = await getCurrentUser(options);
  if (!user) throw new AuthError("You need to sign in to continue");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) {
    throw new AuthError("Only administrators can do that");
  }
  return user;
}

/**
 * Resolves the caller's relationship to a course.
 *
 * A single query fetches the class and the caller's enrollment together, so a
 * role can never be checked against one course and used against another.
 *
 * Memoised per request: a page commonly asks for the same context from the
 * layout and from two or three data helpers, and without this each of those
 * repeated the course query.
 */
export const requireCourseAccess = cache(
  async (courseId: string): Promise<CourseContext> => {
    const user = await requireUser();

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: {
        id: true,
        name: true,
        teacherId: true,
        archived: true,
        postPolicy: true,
        cohortId: true,
        schoolId: true,
        school: {
          select: {
            disabledAt: true,
            members: {
              where: { userId: user.id, status: "ACTIVE" },
              select: { role: true },
            },
          },
        },
        enrollments: {
          where: { userId: user.id },
          select: { role: true, muted: true, active: true },
        },
      },
    });
    if (!course) throw new AuthError("That class no longer exists");

    if (course.school?.disabledAt) {
      throw new AuthError("This school is disabled");
    }
    const enrollment = course.enrollments[0] ?? null;
    const schoolAdmin = course.school?.members[0]?.role === "ADMIN";
    if (enrollment && !enrollment.active && !schoolAdmin) {
      throw new AuthError("You no longer have access to this class");
    }
    const resolved = resolveCourseAccess({ isAdmin: user.isAdmin, enrollment });
    const access = resolved ?? (schoolAdmin
      ? { role: "TEACHER" as const, isTeacher: true, canManage: true, isEnrolled: false }
      : null);
    if (!access) throw new AuthError("You are not enrolled in this class");

    return {
      user,
      courseId: course.id,
      courseName: course.name,
      teacherId: course.teacherId,
      schoolId: course.schoolId,
      cohortId: course.cohortId,
      role: access.role,
      isTeacher: access.isTeacher,
      canManage: access.canManage,
      isEnrolled: access.isEnrolled,
      archived: course.archived,
      postPolicy: course.postPolicy,
      muted: enrollment?.muted ?? false,
    };
  },
);

/** Read access to teacher-only surfaces. Administrators may inspect. */
export async function requireCourseTeacher(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  if (!context.isTeacher) {
    throw new AuthError("Only teachers of this class can do that");
  }
  return context;
}

/** Write access. Only an enrolled teacher of this class qualifies. */
export async function requireCourseManager(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  if (!context.canManage) {
    throw new AuthError("Only teachers of this class can do that");
  }
  return context;
}

export async function requireCourseStudent(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  if (context.role !== "STUDENT" || !context.isEnrolled) {
    throw new AuthError("Only students can submit work");
  }
  return context;
}

/** Refuses every mutation in an archived class. */
export async function requireActiveCourse(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  assertActive(context);
  return context;
}

export async function requireActiveCourseManager(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseManager(courseId);
  assertActive(context);
  return context;
}

export async function requireActiveCourseStudent(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseStudent(courseId);
  assertActive(context);
  return context;
}

function assertActive(context: CourseContext): void {
  if (context.archived) {
    throw new AuthError("This class is archived and is read-only");
  }
}

/** Throws unless the caller may post on this class's stream. */
export function assertCanPost(context: CourseContext): void {
  if (
    !canPostOnStream({
      canManage: context.canManage,
      role: context.role,
      postPolicy: context.postPolicy,
    })
  ) {
    throw new AuthError("Only teachers can post in this class");
  }
}

/** Throws unless the caller may comment on this class's stream. */
export function assertCanComment(context: CourseContext): void {
  if (
    !canCommentOnStream({
      canManage: context.canManage,
      role: context.role,
      postPolicy: context.postPolicy,
    })
  ) {
    throw new AuthError("Only teachers can comment in this class");
  }
}

/**
 * Resolves an assignment *scoped to its course* and requires write access.
 *
 * Taking `courseId` into the `where` clause — rather than checking it after the
 * fact — is what prevents a teacher of one class from acting on another class's
 * assignment by passing their own course id.
 */
export async function requireAssignmentManager(
  courseId: string,
  assignmentId: string,
) {
  const context = await requireActiveCourseManager(courseId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId },
    select: { id: true, courseId: true, maxPoints: true, title: true },
  });
  if (!assignment) throw new AuthError("That assignment no longer exists");

  return { ...context, assignment };
}

/** Loads a submission and proves the caller teaches the course it belongs to. */
export async function requireSubmissionManager(submissionId: string) {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      assignmentId: true,
      status: true,
      grade: true,
      assignment: {
        select: {
          id: true,
          courseId: true,
          maxPoints: true,
          title: true,
          rubric: { select: { id: true, points: true } },
        },
      },
    },
  });
  if (!submission) throw new AuthError("That submission no longer exists");

  const context = await requireActiveCourseManager(submission.assignment.courseId);
  return { ...context, submission };
}

/**
 * Runs a mutation and normalises the result into the `ActionState` shape every
 * form in this app expects.
 */
export async function runAction(
  fn: () => Promise<void | ActionState>,
): Promise<ActionState> {
  try {
    const result = await fn();
    return result ?? { success: true };
  } catch (error) {
    // `redirect()` and `notFound()` signal by throwing; swallowing them would
    // silently break every action that ends in a navigation.
    if (isNextControlFlow(error)) throw error;

    if (error instanceof AuthError || error instanceof ClaimRequiredError) {
      return { error: error.message };
    }

    console.error("[action] Unhandled failure", error);
    return { error: "Something went wrong. Please try again." };
  }
}

function isNextControlFlow(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND")
  );
}
