/**
 * Weighted grading maths.
 *
 * Pure functions only: no Prisma, no React, no `server-only`. The gradebook,
 * the report card and the dashboard all call into this module so a figure shown
 * in three places cannot drift between them.
 *
 * The rules encoded here, in order of importance:
 *
 * 1. A score of `null` means "not marked". It is never zero.
 * 2. A category with no marked items is dropped and its weight is
 *    redistributed across the categories that do have marks. A student is not
 *    penalised for a test the teacher has not entered yet.
 * 3. Rounding happens once, at the end, so category contributions are not
 *    each truncated before being summed.
 */

/** One assessed item, as far as the maths is concerned. */
export type GradeEntry = {
  categoryId: string;
  /** Total marks available. Values `<= 0` are ignored as invalid data. */
  maximum: number;
  /** `null` (or `undefined`) means not marked. */
  score: number | null | undefined;
};

/** A category and the weight (percent) the teacher assigned to it. */
export type CategoryWeight = {
  id: string;
  weight: number;
};

export type CategoryResult = {
  categoryId: string;
  /** Percentage 0–100, unrounded. */
  average: number;
  /** How many items in this category actually have a score. */
  markedCount: number;
  /** Declared weight, as configured by the teacher. */
  weight: number;
  /** Weight after redistribution, as a percentage of the marked categories. */
  effectiveWeight: number;
};

export type TermResult = {
  /** Percentage 0–100 rounded to one decimal, or `null` when nothing is marked. */
  average: number | null;
  /** Only categories that contributed, in the same order as `weights`. */
  categories: CategoryResult[];
  markedItems: number;
  totalItems: number;
};

/** One decimal place, applied exactly once. */
export function roundAverage(value: number): number {
  return Math.round(value * 10) / 10;
}

export function isMarked(score: number | null | undefined): score is number {
  return typeof score === "number" && Number.isFinite(score);
}

/**
 * `sum(score) / sum(maximum) * 100` over the items that have a score.
 *
 * Returns `null` when the category has no usable data, which is the signal the
 * term calculation uses to drop the category entirely.
 */
export function categoryAverage(entries: GradeEntry[]): number | null {
  let earned = 0;
  let possible = 0;

  for (const entry of entries) {
    if (!isMarked(entry.score)) continue;
    if (!Number.isFinite(entry.maximum) || entry.maximum <= 0) continue;

    earned += entry.score;
    possible += entry.maximum;
  }

  if (possible <= 0) return null;
  return (earned / possible) * 100;
}

/**
 * The term percentage.
 *
 * Categories without marks are excluded from both the numerator and the weight
 * denominator; the remaining weights are normalised back to 100%.
 */
export function computeTerm(
  entries: GradeEntry[],
  weights: CategoryWeight[],
): TermResult {
  const grouped = new Map<string, GradeEntry[]>();
  for (const entry of entries) {
    const bucket = grouped.get(entry.categoryId);
    if (bucket) bucket.push(entry);
    else grouped.set(entry.categoryId, [entry]);
  }

  const contributing: Array<{
    categoryId: string;
    average: number;
    markedCount: number;
    weight: number;
  }> = [];

  let totalWeight = 0;

  for (const weight of weights) {
    const bucket = grouped.get(weight.id) ?? [];
    const average = categoryAverage(bucket);
    if (average === null) continue;

    // A zero-weight category can still be displayed, but it must not be
    // allowed to contribute a division by zero to the total.
    contributing.push({
      categoryId: weight.id,
      average,
      markedCount: bucket.filter((entry) => isMarked(entry.score)).length,
      weight: weight.weight,
    });
    totalWeight += weight.weight;
  }

  const markedItems = entries.filter((entry) => isMarked(entry.score)).length;
  const totalItems = entries.length;

  if (contributing.length === 0 || totalWeight <= 0) {
    return { average: null, categories: [], markedItems, totalItems };
  }

  let weighted = 0;
  for (const category of contributing) {
    weighted += category.average * category.weight;
  }

  const categories: CategoryResult[] = contributing.map((category) => ({
    ...category,
    effectiveWeight: (category.weight / totalWeight) * 100,
  }));

  return {
    average: roundAverage(weighted / totalWeight),
    categories,
    markedItems,
    totalItems,
  };
}

/** Convenience wrapper when only the final number is needed. */
export function termAverage(
  entries: GradeEntry[],
  weights: CategoryWeight[],
): number | null {
  return computeTerm(entries, weights).average;
}

/**
 * Percentage for a single score, used by the marks table.
 * Returns `null` rather than dividing by zero on malformed data.
 */
export function scorePercentage(
  score: number | null | undefined,
  maximum: number,
): number | null {
  if (!isMarked(score)) return null;
  if (!Number.isFinite(maximum) || maximum <= 0) return null;
  return (score / maximum) * 100;
}

/**
 * The best possible remaining average, for the "what do I still need" hint.
 * `null` when there is nothing marked to build on.
 */
export function projectedTermAverage(
  entries: GradeEntry[],
  weights: CategoryWeight[],
): number | null {
  return computeTerm(entries, weights).average;
}

/**
 * Term results for every student in a class, from one flat list of entries.
 * Used by the gradebook, the teacher report page and the class average, so the
 * three cannot disagree.
 */
export function computeClassAverages(
  studentIds: string[],
  entries: Array<GradeEntry & { studentId: string }>,
  weights: CategoryWeight[],
): Map<string, TermResult> {
  const byStudent = new Map<string, GradeEntry[]>();
  for (const entry of entries) {
    const bucket = byStudent.get(entry.studentId);
    const stripped: GradeEntry = {
      categoryId: entry.categoryId,
      maximum: entry.maximum,
      score: entry.score,
    };
    if (bucket) bucket.push(stripped);
    else byStudent.set(entry.studentId, [stripped]);
  }

  const results = new Map<string, TermResult>();
  for (const studentId of studentIds) {
    results.set(studentId, computeTerm(byStudent.get(studentId) ?? [], weights));
  }
  return results;
}

/** Mean of the students who actually have an average, one decimal place. */
export function meanOfAverages(averages: Array<number | null>): number | null {
  const marked = averages.filter((value): value is number => value !== null);
  if (marked.length === 0) return null;
  return roundAverage(marked.reduce((sum, value) => sum + value, 0) / marked.length);
}

/** True when the configured weights add up to a whole 100. */
export function weightsTotal(weights: CategoryWeight[]): number {
  return weights.reduce((sum, weight) => sum + weight.weight, 0);
}

export function weightsAreValid(weights: CategoryWeight[]): boolean {
  if (weights.length === 0) return false;
  if (weights.some((w) => !Number.isInteger(w.weight) || w.weight < 0)) {
    return false;
  }
  return weightsTotal(weights) === 100;
}
