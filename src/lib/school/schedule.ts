/**
 * Weekly schedule maths.
 *
 * A course meets on a weekly pattern (weekday + wall-clock times), not on
 * dated events, so "today" has to be resolved in the school's timezone rather
 * than the viewer's. A student travelling abroad must still see Wednesday's
 * timetable when it is Wednesday at school.
 *
 * Pure functions only; the caller supplies `now` and the timezone.
 */

/** Monday-first, matching the register and the month grid. */
export const WEEKDAY_LABELS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export const DEFAULT_SCHOOL_TIMEZONE = "Africa/Kigali";

export type ScheduleSlot = {
  id?: string;
  weekday: number;
  startsAt: string;
  endsAt: string;
  room?: string | null;
  courseId?: string;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

/** "08:30" → 510. Returns `null` for a malformed time. */
export function timeToMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec(value);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(minutes)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(
    clamped % 60,
  ).padStart(2, "0")}`;
}

export function formatTime(value: string): string {
  const minutes = timeToMinutes(value);
  if (minutes === null) return value;

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${String(mins).padStart(2, "0")} ${suffix}`;
}

export function formatTimeRange(startsAt: string, endsAt: string): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/**
 * Validates one slot. Returns an error message, or `null` when it is fine.
 */
export function validateSlot(slot: {
  weekday: number;
  startsAt: string;
  endsAt: string;
}): string | null {
  if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6) {
    return "Pick a day of the week";
  }

  const start = timeToMinutes(slot.startsAt);
  const end = timeToMinutes(slot.endsAt);

  if (start === null) return "Start time must be in 24-hour HH:mm format";
  if (end === null) return "End time must be in 24-hour HH:mm format";
  if (end <= start) return "The end time must be after the start time";

  return null;
}

/** Overlap only matters within the same weekday. */
export function slotsOverlap(
  a: { weekday: number; startsAt: string; endsAt: string },
  b: { weekday: number; startsAt: string; endsAt: string },
): boolean {
  if (a.weekday !== b.weekday) return false;

  const aStart = timeToMinutes(a.startsAt);
  const aEnd = timeToMinutes(a.endsAt);
  const bStart = timeToMinutes(b.startsAt);
  const bEnd = timeToMinutes(b.endsAt);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) {
    return false;
  }

  return aStart < bEnd && bStart < aEnd;
}

/**
 * Every overlapping pair in a set of slots. Used by the editor to refuse a
 * conflicting save instead of silently producing an impossible timetable.
 */
export function findOverlaps<T extends { weekday: number; startsAt: string; endsAt: string }>(
  slots: T[],
): Array<[T, T]> {
  const pairs: Array<[T, T]> = [];

  for (let i = 0; i < slots.length; i += 1) {
    for (let j = i + 1; j < slots.length; j += 1) {
      if (slotsOverlap(slots[i], slots[j])) pairs.push([slots[i], slots[j]]);
    }
  }

  return pairs;
}

export function sortSlots<T extends { weekday: number; startsAt: string }>(
  slots: T[],
): T[] {
  return [...slots].sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday;
    return (timeToMinutes(a.startsAt) ?? 0) - (timeToMinutes(b.startsAt) ?? 0);
  });
}

// ---------------------------------------------------------------------------
// Timezone-aware "today"
// ---------------------------------------------------------------------------

function zonedParts(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(now);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? NaN);

  return { year: read("year"), month: read("month"), day: read("day") };
}

/** "YYYY-MM-DD" for the school's current calendar day. */
export function todayKey(now: Date, timeZone = DEFAULT_SCHOOL_TIMEZONE): string {
  const { year, month, day } = zonedParts(now, timeZone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Monday = 0 … Sunday = 6, in the school's timezone. */
export function weekdayOf(
  dateKey: string,
): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return (jsDay + 6) % 7;
}

export function todayWeekday(
  now: Date,
  timeZone = DEFAULT_SCHOOL_TIMEZONE,
): number {
  return weekdayOf(todayKey(now, timeZone));
}

/** The slots that meet today, earliest first. */
export function slotsForDay<T extends { weekday: number; startsAt: string }>(
  slots: T[],
  weekday: number,
): T[] {
  return sortSlots(slots.filter((slot) => slot.weekday === weekday));
}

export function slotsForToday<T extends { weekday: number; startsAt: string }>(
  slots: T[],
  now: Date,
  timeZone = DEFAULT_SCHOOL_TIMEZONE,
): T[] {
  return slotsForDay(slots, todayWeekday(now, timeZone));
}

/** Groups a week of slots for the editor / timetable view. */
export function groupByWeekday<T extends { weekday: number }>(
  slots: T[],
): Array<{ weekday: number; label: string; slots: T[] }> {
  return WEEKDAY_LABELS.map((label, weekday) => ({
    weekday,
    label,
    slots: slots.filter((slot) => slot.weekday === weekday),
  }));
}

/**
 * True when a slot starts within the 12 hours before `now` and has already
 * finished, which the dashboard uses to dim the morning's lessons.
 */
export function hasSlotEnded(
  slot: { endsAt: string },
  minutesNow: number,
): boolean {
  const end = timeToMinutes(slot.endsAt);
  return end !== null && minutesNow >= end;
}

/** Minutes since midnight for a zoned instant, for "is this lesson now?" */
export function minutesSinceMidnight(
  now: Date,
  timeZone = DEFAULT_SCHOOL_TIMEZONE,
): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(now);
  const read = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return read("hour") * 60 + read("minute");
}
