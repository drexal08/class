export const TARGET_COLUMNS = [
  { key: "BOT", max: 100 },
  { key: "CAT", max: 40 },
  { key: "GW", max: 10 },
  { key: "EUA", max: 50 },
  { key: "MT", max: 100 },
  { key: "EOT", max: 100 },
] as const;

export const TARGET_ROWS = 4;
export const TERM_MAX = 400;

export type Cell = { got: string; total: string };
export type SubjectTargets = Record<string, Cell[]>;

/**
 * Core subjects carry weight ×7 and therefore expose seven assessment rows.
 * Every other subject keeps the standard four-row table. Imports use the same
 * count so pasted marks land in exactly the rows the estimator renders.
 */
export function rowsForWeight(weight: number): number {
  return weight === 7 ? 7 : TARGET_ROWS;
}

/** Average of (got/total) per entry, scaled to the column's maximum. */
export function columnAverage(
  cells: Cell[] | undefined,
  max: number,
): number | null {
  if (!Array.isArray(cells) || !Number.isFinite(max) || max <= 0) return null;
  const ratios: number[] = [];
  for (const c of cells) {
    if (!c || typeof c.got !== "string" || typeof c.total !== "string")
      continue;
    if (c.got.trim() === "" || c.total.trim() === "") continue;
    const got = Number(c.got);
    const total = Number(c.total);
    if (!Number.isFinite(got) || !Number.isFinite(total) || total <= 0) continue;
    ratios.push(Math.min(Math.max(got, 0), total) / total);
  }
  if (!ratios.length) return null;
  return (ratios.reduce((a, b) => a + b, 0) / ratios.length) * max;
}

/**
 * Progressive earned marks out of the full 400-point term.
 * Missing columns add no earned points; the denominator remains fixed.
 */
export function overallAverage(
  data: SubjectTargets,
): { value: number; columns: number } | null {
  let earned = 0;
  let columns = 0;
  for (const c of TARGET_COLUMNS) {
    const avg = columnAverage(data[c.key], c.max);
    if (avg === null) continue;
    earned += avg;
    columns += 1;
  }
  if (!columns) return null;
  return { value: (earned / TERM_MAX) * 100, columns };
}

/**
 * Average of the assessment columns recorded so far, normalised to the maximum
 * of those columns. Unlike `overallAverage`, a missing EOT does not drag the
 * result down before the end-of-term assessment is written.
 */
export function recordedAverage(
  data: SubjectTargets,
): { value: number; columns: number } | null {
  let earned = 0;
  let possible = 0;
  let columns = 0;
  for (const c of TARGET_COLUMNS) {
    const avg = columnAverage(data[c.key], c.max);
    if (avg === null) continue;
    earned += avg;
    possible += c.max;
    columns += 1;
  }
  if (!possible) return null;
  return { value: (earned / possible) * 100, columns };
}

/** Every assessment column except the special EOT column has a recorded entry. */
export function hasAllAssessmentsExceptEot(data: SubjectTargets): boolean {
  return TARGET_COLUMNS.every(
    (c) => c.key === "EOT" || columnAverage(data[c.key], c.max) !== null,
  );
}

/**
 * The EOT column average (out of 100) needed to reach `target` as the overall
 * term average, given the other filled columns.
 */
export function requiredEotAverage(
  data: SubjectTargets,
  target: number,
): number | null {
  if (!Number.isFinite(target) || target < 0 || target > 100) return null;
  let earned = 0;
  let possible = 0;
  for (const c of TARGET_COLUMNS) {
    if (c.key === "EOT") continue;
    const avg = columnAverage(data[c.key], c.max);
    if (avg === null) continue;
    earned += avg;
    possible += c.max;
  }
  if (!possible) return null;
  return (target * TERM_MAX) / 100 - earned;
}
