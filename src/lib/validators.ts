import { z } from "zod";

/** Prisma cuids and Firebase UIDs are both opaque strings. */
const id = z.string().trim().min(1, "Missing identifier").max(64);
const optionalId = z
  .string()
  .trim()
  .max(64)
  .optional()
  .transform((value) => (value ? value : undefined));

/** Trims, then converts "" to undefined so optional text fields stay null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Email is required")
  .email("Enter a valid email address");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(80, "Name is too long"),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password is too long"),
  role: z.enum(["TEACHER", "STUDENT"]).default("STUDENT"),
});

/** Body of POST /api/auth/session. */
export const sessionSchema = z.object({
  idToken: z.string().min(1).optional(),
  /** Only honoured on first sign-in; a user can never escalate later. */
  intendedRole: z.enum(["TEACHER", "STUDENT"]).optional(),
  /** Development sign-in only; ignored unless AUTH_DEV_MODE is on. */
  devEmail: emailSchema.optional(),
  devName: optionalText(80),
});

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

export const createCourseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Class name must be at least 2 characters")
    .max(120, "Class name is too long"),
  section: optionalText(80),
  subject: optionalText(80),
  room: optionalText(60),
});

export const updateCourseSchema = createCourseSchema.extend({
  courseId: id,
  description: optionalText(2_000),
  postPolicy: z
    .enum([
      "STUDENTS_CAN_POST_AND_COMMENT",
      "STUDENTS_CAN_COMMENT_ONLY",
      "ONLY_TEACHERS",
    ])
    .default("STUDENTS_CAN_POST_AND_COMMENT"),
});

export const joinCourseSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .length(7, "Class codes are 7 characters")
    .regex(/^[A-Z0-9]+$/, "Class codes use letters and numbers only"),
});

// ---------------------------------------------------------------------------
// Stream
// ---------------------------------------------------------------------------

export const createAnnouncementSchema = z.object({
  courseId: id,
  content: z
    .string()
    .trim()
    .min(1, "Write something to post")
    .max(10_000, "Post is too long"),
});

export const commentSchema = z
  .object({
    content: z
      .string()
      .trim()
      .min(1, "Write a comment")
      .max(5_000, "Comment is too long"),
    courseId: id,
    announcementId: optionalId,
    assignmentId: optionalId,
    submissionId: optionalId,
    isPrivate: z.coerce.boolean().default(false),
  })
  .refine(
    (value) =>
      [value.announcementId, value.assignmentId, value.submissionId].filter(
        Boolean,
      ).length === 1,
    { message: "A comment must belong to exactly one item" },
  );

// ---------------------------------------------------------------------------
// Classwork
// ---------------------------------------------------------------------------

export const assignmentTypeSchema = z.enum([
  "ASSIGNMENT",
  "QUIZ",
  "QUESTION",
  "MATERIAL",
]);

export const createAssignmentSchema = z.object({
  courseId: id,
  title: z
    .string()
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(300, "Title is too long"),
  description: optionalText(10_000),
  type: assignmentTypeSchema.default("ASSIGNMENT"),
  maxPoints: z.coerce
    .number()
    .int("Points must be a whole number")
    .min(0, "Points cannot be negative")
    .max(10_000, "Points must be 10,000 or less")
    .default(100),
  dueDate: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? new Date(value) : undefined))
    .refine((value) => !value || !Number.isNaN(value.getTime()), {
      message: "Enter a valid due date",
    }),
  topicId: optionalId,
  published: z.coerce.boolean().default(true),
});

export const createTopicSchema = z.object({
  courseId: id,
  name: z
    .string()
    .trim()
    .min(1, "Topic name is required")
    .max(120, "Topic name is too long"),
});

export const rubricCriterionSchema = z.object({
  title: z.string().trim().min(1, "Criterion title is required").max(160),
  description: optionalText(600),
  points: z.coerce.number().int().min(0).max(1_000).default(10),
});

// ---------------------------------------------------------------------------
// Submissions & grading
// ---------------------------------------------------------------------------

export const submitWorkSchema = z.object({
  assignmentId: id,
  content: optionalText(20_000),
});

export const gradeSubmissionSchema = z.object({
  submissionId: id,
  /** Blank clears the grade, so this stays optional rather than coerced to 0. */
  grade: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : undefined))
    .refine((value) => value === undefined || !Number.isNaN(value), {
      message: "Grade must be a number",
    })
    .refine((value) => value === undefined || value >= 0, {
      message: "Grade cannot be negative",
    }),
  feedback: optionalText(10_000),
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------

export const presignSchema = z.object({
  courseId: id,
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(160),
  size: z.number().int().positive(),
  scope: z.enum(["announcement", "assignment", "submission"]),
});

export const attachmentMetaSchema = z.object({
  name: z.string().trim().min(1).max(255),
  url: z.string().trim().url().max(2_000),
  key: z.string().trim().min(1).max(600),
  mimeType: optionalText(160),
  size: z.coerce.number().int().nonnegative().optional(),
});

/** Extracts the first readable message from a Zod failure. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Please check the form and try again";
}

/** Builds a field-name → message map for inline form errors. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}
