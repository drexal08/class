/**
 * Attendance maths and calendar bucketing.
 *
 * Pure functions only. The same rules are used by the teacher register, the
 * student month view and the report card:
 *
 * - `PRESENT` and `LATE` both count as attending (a late student did arrive).
 * - `ABSENT` and `LEFT_EARLY` count against the rate.
 * - `EXCUSED` is excluded from both the numerator and the denominator, because
 *   an authorized absence should not be punished.
 * - A day with no session at all is "not recorded". It must never be silently
 *   treated as an absence.
 */

export const ATTENDANCE_STATUSES = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  "LEFT_EARLY",
] as const;

export type AttendanceStatusValue = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_LABELS: Record<AttendanceStatusValue, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
  EXCUSED: "Excused",
  LEFT_EARLY: "Left early",
};

/** Statuses that count towards the numerator. */
export const PRESENT_STATUSES: AttendanceStatusValue[] = ["PRESENT", "LATE"];

/** Statuses that count towards the denominator but not the numerator. */
export const MISSED_STATUSES: AttendanceStatusValue[] = ["ABSENT", "LEFT_EARLY"];

export type AttendanceCounts = {
  present: number;
  late: number;
  absent: number;
  excused: number;
  leftEarly: number;
  /** Days that count towards the rate (everything except excused). */
  counted: number;
  /** Days present or late. */
  attended: number;
};

export const EMPTY_ATTENDANCE_COUNTS: AttendanceCounts = {
  present: 0,
  late: 0,
  absent: 0,
  excused: 0,
  leftEarly: 0,
  counted: 0,
  attended: 0,
};

export function countsForStatus(status: AttendanceStatusValue): AttendanceCounts {
  return summariseAttendance([status]);
}

export function summariseAttendance(
  statuses: AttendanceStatusValue[],
): AttendanceCounts {
  const counts: AttendanceCounts = { ...EMPTY_ATTENDANCE_COUNTS };

  for (const status of statuses) {
    switch (status) {
      case "PRESENT":
        counts.present += 1;
        break;
      case "LATE":
        counts.late += 1;
        break;
      case "ABSENT":
        counts.absent += 1;
        break;
      case "EXCUSED":
        counts.excused += 1;
        break;
      case "LEFT_EARLY":
        counts.leftEarly += 1;
        break;
    }
  }

  counts.attended = counts.present + counts.late;
  counts.counted = counts.present + counts.late + counts.absent + counts.leftEarly;

  return counts;
}

/**
 * Attendance percentage, one decimal place, or `null` when there is nothing to
 * measure (no sessions, or every session was excused).
 */
export function attendanceRate(
  statuses: AttendanceStatusValue[],
): number | null {
  const counts = summariseAttendance(statuses);
  if (counts.counted === 0) return null;
  return Math.round((counts.attended / counts.counted) * 1000) / 10;
}

export function attendanceRateFromCounts(counts: AttendanceCounts): number | null {
  if (counts.counted === 0) return null;
  return Math.round((counts.attended / counts.counted) * 1000) / 10;
}

export function isPresent(status: AttendanceStatusValue): boolean {
  return status === "PRESENT" || status === "LATE";
}

// ---------------------------------------------------------------------------
// Calendar dates
//
// Attendance dates are date-only values stored at UTC midnight. They are never
// converted into the viewer's local timezone, because doing so would shift a
// Monday register onto Sunday for anyone west of UTC.
// ---------------------------------------------------------------------------

export function toDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "2026-11-18" → Date at 00:00 UTC. */
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
}

export function isValidDateKey(key: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const parsed = parseDateKey(key);
  return toDateKey(parsed) === key;
}

export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export type MonthCell = {
  key: string;
  /** Midnight UTC for this calendar day. */
  date: Date;
  dayOfMonth: number;
  inMonth: boolean;
  statuses: AttendanceStatusValue[];
};

export type MonthMatrix = {
  year: number;
  /** 1–12. */
  month: number;
  weeks: MonthCell[][];
};

/**
 * Builds Monday-first weeks covering `month`, padded with the adjacent days so
 * every row has seven cells. `byDay` supplies the statuses recorded on a day;
 * days with no entry are rendered as "not recorded", never as absent.
 */
export function buildMonthMatrix(
  year: number,
  month: number,
  byDay: Map<string, AttendanceStatusValue[]> = new Map(),
  weekStartsOn = 1,
): MonthMatrix {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  // 0 = Sunday in JS; shift so Monday is 0.
  const firstWeekday = (first.getUTCDay() - weekStartsOn + 7) % 7;
  const cells: MonthCell[] = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(Date.UTC(year, month - 1, 1 - (firstWeekday - index)));
    cells.push(makeCell(date, false, byDay));
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(makeCell(new Date(Date.UTC(year, month - 1, day)), true, byDay));
  }

  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push(
      makeCell(
        new Date(
          Date.UTC(
            last.getUTCFullYear(),
            last.getUTCMonth(),
            last.getUTCDate() + 1,
          ),
        ),
        false,
        byDay,
      ),
    );
  }

  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }

  return { year, month, weeks };
}

function makeCell(
  date: Date,
  inMonth: boolean,
  byDay: Map<string, AttendanceStatusValue[]>,
): MonthCell {
  const key = toDateKey(date);
  return {
    key,
    date,
    dayOfMonth: date.getUTCDate(),
    inMonth,
    statuses: byDay.get(key) ?? [],
  };
}

/**
 * Aggregates raw records into one status list per calendar day, which is what
 * the month grid needs when a student is enrolled in several courses.
 */
export function bucketStatusesByDay(
  records: Array<{ date: Date; status: AttendanceStatusValue }>,
): Map<string, AttendanceStatusValue[]> {
  const byDay = new Map<string, AttendanceStatusValue[]>();

  for (const record of records) {
    const key = toDateKey(record.date);
    const bucket = byDay.get(key);
    if (bucket) bucket.push(record.status);
    else byDay.set(key, [record.status]);
  }

  return byDay;
}

/** The dominant status for a day, used to colour one cell. */
export function summariseDay(
  statuses: AttendanceStatusValue[],
): AttendanceStatusValue | null {
  if (statuses.length === 0) return null;
  if (statuses.some((status) => status === "ABSENT")) return "ABSENT";
  if (statuses.some((status) => status === "LEFT_EARLY")) return "LEFT_EARLY";
  if (statuses.some((status) => status === "LATE")) return "LATE";
  if (statuses.some((status) => status === "PRESENT")) return "PRESENT";
  return "EXCUSED";
}
