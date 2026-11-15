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
 * restrained slate-family tone used only as a thin rule or small chip — never as
 * a large filled surface.
 *
 * The tones are a ladder: `slate`/`stone` are the darkest, `*-light` sit in the
 * middle and `*-pale` are the lightest. Six steps give each class a face of
 * its own without introducing a second, competing palette.
 */
export const COURSE_ACCENTS = [
  "slate",
  "stone",
  "slate-light",
  "stone-light",
  "slate-pale",
  "stone-pale",
] as const;

export type CourseAccent = (typeof COURSE_ACCENTS)[number];

/**
 * Accent names that older rows may still carry.
 *
 * The column used to hold hue names. They are legacy labels only: each one
 * maps onto the nearest tone in the ladder, so an old row still renders in the
 * neutral palette instead of bringing a colour back.
 */
const LEGACY_ACCENTS: Record<string, CourseAccent> = {
  teal: "slate-light",
  indigo: "stone-light",
  amber: "slate-pale",
  rose: "stone-pale",
};

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
    rule: "bg-slate-600",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-slate-600 text-white",
  },
  stone: {
    rule: "bg-stone-600",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-stone-600 text-white",
  },
  "slate-light": {
    rule: "bg-slate-500",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-slate-500 text-white",
  },
  "stone-light": {
    rule: "bg-stone-500",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-stone-500 text-white",
  },
  "slate-pale": {
    rule: "bg-slate-400",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-slate-300 text-slate-900",
  },
  "stone-pale": {
    rule: "bg-stone-400",
    chip: "bg-secondary text-secondary-foreground border-border",
    avatar: "bg-stone-300 text-stone-900",
  },
};

export function accentClasses(accent: string | null | undefined) {
  if (!accent) return ACCENT_CLASSES.slate;
  const direct = ACCENT_CLASSES[accent as CourseAccent];
  if (direct) return direct;
  const legacy = LEGACY_ACCENTS[accent];
  return legacy ? ACCENT_CLASSES[legacy] : ACCENT_CLASSES.slate;
}
