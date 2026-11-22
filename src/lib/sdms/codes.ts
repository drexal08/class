import { randomInt } from "node:crypto";

export type SchoolJoinCodeKind = "SCHOOL" | "COHORT" | "COURSE";

// No 0/O, 1/I/L: codes must survive printouts and phone screenshots.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const BODY_LENGTH = 8;

export function normalizeJoinCode(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, "").toUpperCase();
}

export function generateJoinCode(kind: SchoolJoinCodeKind): string {
  const prefix = kind === "SCHOOL" ? "SCH-" : "CLS-";
  let body = "";
  for (let index = 0; index < BODY_LENGTH; index += 1) {
    body += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return `${prefix}${body}`;
}
