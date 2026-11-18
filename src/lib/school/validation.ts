import { z } from "zod";

import { ATTENDANCE_STATUSES, isValidDateKey, parseDateKey } from "./attendance";
import { isValidTime } from "./schedule";

/**
 * Input schemas for the school-records actions.
 *
 * Kept separate from `src/lib/validators.ts` so the existing auth/coursework
 * schemas stay untouched, and so the school rules (weights must total 100,
 * a date range must run forwards) live next to the code that enforces them.
 */

const id = z.string().trim().min(1, "Missing identifier").max(64);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** "YYYY-MM-DD" → Date at UTC midnight, rejecting impossible calendar days. */
const dateOnly = z
  .string()
  .trim()
  .refine((value) => isValidDateKey(value), "Enter a valid date")
  .transform((value) => parseDateKey(value));

const time = z
  .string()
  .trim()
  .refine((value) => isValidTime(value), "Use a 24-hour time such as 08:00");

/** Blank means "not marked", which is different from zero. */
const nullableScore = z
  .union([z.string(), z.number(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const text = typeof value === "number" ? String(value) : value.trim();
    if (text === "") return null;
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  })
  .refine(
    (value) => value === null || (Number.isFinite(value) && value >= 0),
    "Enter a score of 0 or more, or leave it blank",
  );

const optionalInteger = (max: number) =>
  z.preprocess(
    (value) => {
      if (value === "" || value === null || value === undefined) return undefined;
      if (typeof value === "number") return value;
      const parsed = Number(String(value).trim());
      return Number.isFinite(parsed) ? parsed : value;
    },
    z.number().int("Use whole minutes").min(0).max(max).optional(),
  );

// ---------------------------------------------------------------------------
// Terms
// ---------------------------------------------------------------------------

export const termSchema = z
  .object({
    academicYear: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{4}$/, "Use a year range such as 2026-2027"),
    name: z.string().trim().min(1, "Name the term").max(60),
    startsOn: dateOnly,
    endsOn: dateOnly,
    isActive: z.boolean().default(false),
  })
  .refine((value) => value.endsOn > value.startsOn, {
    message: "The term must end after it starts",
    path: ["endsOn"],
  });

// ---------------------------------------------------------------------------
// Gradebook
// ---------------------------------------------------------------------------

export const categoryInputSchema = z.object({
  /** Present when an existing category is being edited in place. */
  id: z
    .string()
    .trim()
    .max(64)
    .optional()
    .transform((value) => (value ? value : undefined)),
  name: z.string().trim().min(1, "Name the category").max(60),
  weight: z.coerce
    .number()
    .int("Weights are whole percentages")
    .min(0, "Weights cannot be negative")
    .max(100, "A weight cannot exceed 100%"),
});

export const saveCategoriesSchema = z
  .object({
    courseId: id,
    termId: id,
    categories: z
      .array(categoryInputSchema)
      .min(1, "Add at least one category")
      .max(20, "That is too many categories"),
  })
  .superRefine((value, ctx) => {
    const total = value.categories.reduce(
      (sum, category) => sum + category.weight,
      0,
    );

    if (total !== 100) {
      ctx.addIssue({
        code: "custom",
        path: ["categories"],
        message: `Weights must add up to exactly 100% (currently ${total}%)`,
      });
    }

    const seen = new Set<string>();
    for (const category of value.categories) {
      const key = category.name.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["categories"],
          message: `"${category.name}" appears twice`,
        });
      }
      seen.add(key);
    }
  });

export const gradeItemSchema = z.object({
  courseId: id,
  termId: id,
  categoryId: id,
  title: z.string().trim().min(1, "Give the item a title").max(120),
  maximum: z.coerce
    .number()
    .positive("The maximum must be greater than zero")
    .max(10_000, "That maximum is too large"),
  assessedOn: dateOnly,
});

/** One cell of the gradebook grid. `score === null` clears the mark. */
export const scoreInputSchema = z.object({
  courseId: id,
  termId: id,
  gradeItemId: id,
  studentId: id,
  score: nullableScore,
});

export const reportCommentSchema = z.object({
  courseId: id,
  termId: id,
  studentId: id,
  body: z.string().trim().max(4_000, "That comment is too long"),
});

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES);

export const attendanceRecordInputSchema = z
  .object({
    studentId: id,
    status: attendanceStatusSchema,
    note: optionalText(200),
    minutesLate: optionalInteger(600),
  })
  .refine(
    (value) => value.status === "LATE" || value.minutesLate === undefined,
    {
      message: "Only a late arrival can have minutes late",
      path: ["minutesLate"],
    },
  );

export const saveAttendanceSchema = z.object({
  courseId: id,
  date: dateOnly,
  /** Set only when the course meets more than once on the same day. */
  period: optionalText(20),
  topic: optionalText(200),
  records: z
    .array(attendanceRecordInputSchema)
    .min(1, "There is nobody on the register")
    .max(500),
});

export const absenceRequestSchema = z
  .object({
    courseId: id,
    fromDate: dateOnly,
    toDate: dateOnly,
    reason: z
      .string()
      .trim()
      .min(5, "Give a short reason")
      .max(1_000, "That reason is too long"),
  })
  .refine((value) => value.toDate >= value.fromDate, {
    message: "The last day cannot be before the first day",
    path: ["toDate"],
  });

export const attendanceDecisionSchema = z.object({
  courseId: id,
  requestId: id,
  status: z.enum(["APPROVED", "DECLINED"]),
  note: optionalText(500),
});

// ---------------------------------------------------------------------------
// Schedule
// ---------------------------------------------------------------------------

export const scheduleSlotSchema = z.object({
  weekday: z.coerce
    .number()
    .int()
    .min(0, "Pick a day of the week")
    .max(6, "Pick a day of the week"),
  startsAt: time,
  endsAt: time,
  room: optionalText(60),
});

export const saveScheduleSchema = z.object({
  courseId: id,
  slots: z.array(scheduleSlotSchema).max(40, "That is too many weekly slots"),
});

// ---------------------------------------------------------------------------
// Report cards
// ---------------------------------------------------------------------------

export const reportCardQuerySchema = z.object({
  termId: id,
  courseId: id.optional(),
});
