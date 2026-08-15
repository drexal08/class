import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Join-code alphabet, deliberately free of visually ambiguous characters
 * (no I/O/0/1) so codes can be read aloud in a classroom without confusion.
 */
const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Generates a 7-character course join code, per PRD §3. */
export function generateJoinCode(length = 7): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let code = "";
  for (let i = 0; i < length; i += 1) {
    code += JOIN_CODE_ALPHABET[bytes[i] % JOIN_CODE_ALPHABET.length];
  }
  return code;
}

/** "Ada Lovelace" -> "AL". Falls back to the email local-part. */
export function getInitials(name?: string | null, email?: string | null): string {
  const source = name?.trim() || email?.split("@")[0] || "";
  if (!source) return "?";

  const parts = source.split(/[\s._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Display name with a sensible fallback so the UI never renders "null". */
export function displayNameOf(user: {
  displayName?: string | null;
  email?: string | null;
}): string {
  return user.displayName?.trim() || user.email?.split("@")[0] || "Unknown user";
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "2 hours ago" / "in 3 days" — used for stream timestamps. */
export function formatRelative(date: Date | string | null | undefined): string {
  if (!date) return "";

  const target = new Date(date).getTime();
  const diffSeconds = Math.round((target - Date.now()) / 1000);
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ["year", 60 * 60 * 24 * 365],
    ["month", 60 * 60 * 24 * 30],
    ["week", 60 * 60 * 24 * 7],
    ["day", 60 * 60 * 24],
    ["hour", 60 * 60],
    ["minute", 60],
  ];

  const formatter = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diffSeconds) >= seconds) {
      return formatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return formatter.format(diffSeconds, "second");
}

export function isOverdue(dueDate: Date | string | null | undefined): boolean {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

/** Formats a due date the way the classwork list shows it. */
export function formatDueDate(dueDate: Date | string | null | undefined): string {
  if (!dueDate) return "No due date";

  const due = new Date(dueDate);
  const now = new Date();
  const sameYear = due.getFullYear() === now.getFullYear();

  return `Due ${due.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}, ${due.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`;
}

/**
 * Muted accent tokens for course identity.
 *
 * The PRD forbids bright saturated colour, so a course is identified by a
 * restrained slate-family hue used only as a thin rule or small chip — never as
 * a large filled surface.
 */
export const COURSE_ACCENTS = [
  "slate",
  "stone",
  "teal",
  "indigo",
  "amber",
  "rose",
] as const;

export type CourseAccent = (typeof COURSE_ACCENTS)[number];

export function randomAccent(): CourseAccent {
  return COURSE_ACCENTS[Math.floor(Math.random() * COURSE_ACCENTS.length)];
}

/** Deterministic accent so a user's avatar colour is stable across renders. */
export function accentFor(seed: string): CourseAccent {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return COURSE_ACCENTS[hash % COURSE_ACCENTS.length];
}

/**
 * Tailwind classes per accent. Written out in full because Tailwind's compiler
 * only sees class names that appear literally in source.
 */
export const ACCENT_CLASSES: Record<
  CourseAccent,
  { rule: string; chip: string; avatar: string }
> = {
  slate: {
    rule: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 border-slate-200",
    avatar: "bg-slate-600 text-white",
  },
  stone: {
    rule: "bg-stone-400",
    chip: "bg-stone-100 text-stone-700 border-stone-200",
    avatar: "bg-stone-600 text-white",
  },
  teal: {
    rule: "bg-teal-500",
    chip: "bg-teal-50 text-teal-700 border-teal-200",
    avatar: "bg-teal-700 text-white",
  },
  indigo: {
    rule: "bg-indigo-500",
    chip: "bg-indigo-50 text-indigo-700 border-indigo-200",
    avatar: "bg-indigo-700 text-white",
  },
  amber: {
    rule: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800 border-amber-200",
    avatar: "bg-amber-700 text-white",
  },
  rose: {
    rule: "bg-rose-400",
    chip: "bg-rose-50 text-rose-700 border-rose-200",
    avatar: "bg-rose-700 text-white",
  },
};

export function accentClasses(accent: string | null | undefined) {
  return ACCENT_CLASSES[(accent as CourseAccent) ?? "slate"] ?? ACCENT_CLASSES.slate;
}
