export type ImportedGender = "MALE" | "FEMALE";

/** Canonical student identity: uppercase text, never a numeric database value. */
export function normalizeStudentCode(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) {
    return null;
  }

  const code = String(value).trim().replace(/\s+/g, "").toUpperCase();
  return /^(?=.*[A-Z0-9])[A-Z0-9-]{6,20}$/.test(code) ? code : null;
}

export function studentAuthEmail(code: unknown, domain: string): string {
  const normalizedCode = normalizeStudentCode(code);
  const normalizedDomain = domain.trim().toLowerCase();
  if (!normalizedCode) throw new Error("Invalid student code");
  if (!/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(normalizedDomain)) {
    throw new Error("Invalid student email domain");
  }
  return `${normalizedCode.toLowerCase()}@${normalizedDomain}`;
}

export function collapseWhitespace(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Display form only; the exact imported spelling is stored separately. */
export function normalizeDisplayName(value: unknown): string {
  return collapseWhitespace(value)
    .toLocaleLowerCase("en")
    .replace(/(^|[\s'’-])(\p{L})/gu, (_match, prefix: string, letter: string) =>
      `${prefix}${letter.toLocaleUpperCase("en")}`,
    );
}

export function normalizeGender(value: unknown): ImportedGender | null {
  const gender = collapseWhitespace(value).toUpperCase();
  if (["M", "MALE", "BOY", "B"].includes(gender)) return "MALE";
  if (["F", "FEMALE", "GIRL", "G"].includes(gender)) return "FEMALE";
  return null;
}

export function normalizeGrade(value: unknown): string | null {
  const match = collapseWhitespace(value).match(/^(?:SENIOR\s*|S)\s*([1-6])$/i);
  return match ? `S${match[1]}` : null;
}

export function parseAcademicYear(
  value: unknown,
): { startYear: number; label: string } | null {
  const text = collapseWhitespace(value);
  const match = text.match(/(20\d{2})\s*\/\s*(20\d{2})/);
  if (!match) return null;
  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;
  return { startYear, label: `${startYear}/${endYear}` };
}

function canonicalText(value: unknown): string {
  return collapseWhitespace(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Removes `X (X)` only when both sides are genuinely the same label. */
export function normalizeCombinationText(value: unknown): string {
  const text = collapseWhitespace(value);
  const match = text.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
  if (!match) return text;
  const [, base, parenthetical] = match;
  return canonicalText(base) === canonicalText(parenthetical) ? base.trim() : text;
}

export function normalizeAlias(value: unknown): string {
  return canonicalText(normalizeCombinationText(value));
}

/** Temporary provisioning password. Routine roster re-import never resets it. */
export function defaultCohortPassword(seedYear: number): string {
  if (!Number.isInteger(seedYear) || seedYear < 2000 || seedYear > 2100) {
    throw new Error("Invalid password seed year");
  }
  return `Cla@${seedYear}`;
}
