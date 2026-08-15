import "server-only";

import { getCurrentUser, getEnrollment } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { ActionState, SessionUser } from "@/lib/types";
import type { Role } from "@/generated/prisma/client";

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
  role: Role;
  isTeacher: boolean;
  muted: boolean;
};

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("You need to sign in to continue");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") {
    throw new AuthError("Only administrators can do that");
  }
  return user;
}

/** Any member of the course — teacher or student. */
export async function requireCourseAccess(
  courseId: string,
): Promise<CourseContext> {
  const user = await requireUser();

  // An admin can inspect any course without being enrolled in it.
  if (user.role === "ADMIN") {
    return {
      user,
      courseId,
      role: "ADMIN",
      isTeacher: true,
      muted: false,
    };
  }

  const enrollment = await getEnrollment(user.id, courseId);
  if (!enrollment) throw new AuthError("You are not enrolled in this class");

  return {
    user,
    courseId,
    role: enrollment.role,
    isTeacher: enrollment.role === "TEACHER",
    muted: enrollment.muted,
  };
}

export async function requireCourseTeacher(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  if (!context.isTeacher) {
    throw new AuthError("Only teachers of this class can do that");
  }
  return context;
}

export async function requireCourseStudent(
  courseId: string,
): Promise<CourseContext> {
  const context = await requireCourseAccess(courseId);
  if (context.role !== "STUDENT") {
    throw new AuthError("Only students can submit work");
  }
  return context;
}

/**
 * Resolves an assignment *scoped to its course*.
 *
 * Taking `courseId` into the `where` clause — rather than checking it after the
 * fact — is what prevents a teacher of one class from acting on another class's
 * assignment by passing their own course id.
 */
export async function requireAssignmentTeacher(
  courseId: string,
  assignmentId: string,
) {
  const context = await requireCourseTeacher(courseId);

  const assignment = await prisma.assignment.findFirst({
    where: { id: assignmentId, courseId },
    select: { id: true, courseId: true, maxPoints: true, title: true },
  });
  if (!assignment) throw new AuthError("That assignment no longer exists");

  return { ...context, assignment };
}

/** Loads a submission and proves the caller teaches the course it belongs to. */
export async function requireSubmissionTeacher(submissionId: string) {
  const user = await requireUser();

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      studentId: true,
      assignmentId: true,
      assignment: {
        select: { id: true, courseId: true, maxPoints: true, title: true },
      },
    },
  });
  if (!submission) throw new AuthError("That submission no longer exists");

  const context = await requireCourseTeacher(submission.assignment.courseId);
  return { ...context, submission, user };
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

    if (error instanceof AuthError) return { error: error.message };

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
