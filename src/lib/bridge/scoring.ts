export type WeightedSubject = { name: string; weight: number };

/**
 * Weighted report percentage: each mark is out of 100 and counts `weight`
 * times, so the percentage is weighted-earned / total-weight.
 * Marks are clamped to 0–100; empty or non-numeric entries are skipped.
 */
export function computeWeightedPercentage(
  subjects: WeightedSubject[],
  marks: Record<string, unknown>,
): { pct: number; earned: number; maxPoints: number; filled: number } {
  const validSubjects = subjects.filter(
    (subject) => Number.isFinite(subject.weight) && subject.weight > 0,
  );
  const maxPoints = validSubjects.reduce(
    (sum, subject) => sum + subject.weight,
    0,
  );
  let earned = 0;
  let filled = 0;
  for (const subject of validSubjects) {
    const raw = marks[subject.name];
    if (typeof raw !== "string" || raw.trim() === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    earned += Math.min(100, Math.max(0, value)) * subject.weight;
    filled += 1;
  }
  return {
    pct: maxPoints > 0 ? earned / maxPoints : 0,
    earned,
    maxPoints,
    filled,
  };
}
