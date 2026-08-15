import type { AssignmentType, Role, SubmissionState } from "@/generated/prisma/client";

/**
 * Return shape for every server action.
 *
 * Kept identical to the original contract so all existing `useActionState`
 * forms continue to work: `useActionState<ActionState, FormData>(action, {})`.
 */
export type ActionState = {
  error?: string;
  success?: boolean;
  /** Field-level messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
};

export const EMPTY_ACTION_STATE: ActionState = {};

/** The authenticated user, as resolved once per request. */
export type SessionUser = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: Role;
};

// ---------------------------------------------------------------------------
// Display labels — centralised so enum renaming never leaks into components
// ---------------------------------------------------------------------------

export const SUBMISSION_LABELS: Record<SubmissionState, string> = {
  ASSIGNED: "Assigned",
  SUBMITTED: "Turned in",
  LATE: "Turned in late",
  GRADED: "Graded",
  RETURNED: "Returned",
};

/**
 * Status tone classes. Colour is used here because status is exactly the case
 * where a student must notice at a glance; tones stay desaturated per the
 * design brief.
 */
export const SUBMISSION_TONES: Record<SubmissionState, string> = {
  ASSIGNED: "bg-secondary text-muted-foreground border-border",
  SUBMITTED: "bg-info-muted text-info border-info/20",
  LATE: "bg-warning-muted text-warning border-warning/20",
  GRADED: "bg-success-muted text-success border-success/20",
  RETURNED: "bg-success-muted text-success border-success/20",
};

export const ASSIGNMENT_LABELS: Record<AssignmentType, string> = {
  ASSIGNMENT: "Assignment",
  QUIZ: "Quiz",
  QUESTION: "Question",
  MATERIAL: "Material",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  TEACHER: "Teacher",
  STUDENT: "Student",
};

/** States in which a student has actually handed work in. */
export const TURNED_IN_STATES: SubmissionState[] = [
  "SUBMITTED",
  "LATE",
  "GRADED",
  "RETURNED",
];

export function hasTurnedIn(state: SubmissionState): boolean {
  return TURNED_IN_STATES.includes(state);
}
