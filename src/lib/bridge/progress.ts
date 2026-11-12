import type { WeightedSubject } from "@/lib/bridge/scoring";

const LEGACY_TARGET_COLUMNS = [
  { key: "BOT", max: 100 },
  { key: "CAT", max: 40 },
  { key: "GW", max: 10 },
  { key: "EUA", max: 50 },
  { key: "MT", max: 100 },
  { key: "EOT", max: 100 },
] as const;

export function validMark(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 100
    ? number
    : null;
}

/**
 * A current mark, read the same way the weighted gauge reads it.
 *
 * The gauge clamps a mark to 0–100, so the progress panels have to clamp it
 * too; otherwise a subject the gauge counts disappears from the averages and
 * the two numbers disagree. Targets stay strict — an out-of-range target is a
 * typo, not a mark to round.
 */
export function normalizedMark(value: unknown): number | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.min(100, Math.max(0, number));
}

function legacyColumnAverage(value: unknown, max: number) {
  if (!Array.isArray(value) || max <= 0) return null;
  const ratios: number[] = [];
  for (const cell of value) {
    if (!cell || typeof cell !== "object") continue;
    const { got, total } = cell as { got?: unknown; total?: unknown };
    if (
      typeof got !== "string" ||
      typeof total !== "string" ||
      !got.trim() ||
      !total.trim()
    )
      continue;
    const gotValue = Number(got);
    const totalValue = Number(total);
    if (!Number.isFinite(gotValue) || !Number.isFinite(totalValue) || totalValue <= 0)
      continue;
    ratios.push(Math.min(Math.max(gotValue, 0), totalValue) / totalValue);
  }
  return ratios.length
    ? (ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length) * max
    : null;
}

/** Preserve old target tables by converting their weighted average into one target. */
export function normalizeGoals(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [name, goal] of Object.entries(value)) {
    if (
      validMark(goal) !== null ||
      (typeof goal === "number" && validMark(String(goal)) !== null)
    )
      result[name] = String(goal);
    else if (goal && typeof goal === "object" && !Array.isArray(goal)) {
      // Keep the original table conversion stable even if current term scoring changes.
      const table = goal as Record<string, unknown>;
      let earned = 0;
      let possible = 0;
      for (const column of LEGACY_TARGET_COLUMNS) {
        const average = legacyColumnAverage(table[column.key], column.max);
        if (average === null) continue;
        earned += average;
        possible += column.max;
      }
      if (possible) result[name] = String((earned / possible) * 100);
    }
  }
  return result;
}

/** Missing targets are excluded, never interpreted as zero. */
export function targetAverage(
  subjects: WeightedSubject[],
  goals: Record<string, string>,
) {
  let earned = 0;
  let weight = 0;
  let filled = 0;
  for (const subject of subjects) {
    const goal = validMark(goals[subject.name]);
    if (goal === null) continue;
    earned += goal * subject.weight;
    weight += subject.weight;
    filled += 1;
  }
  return { value: weight ? earned / weight : null, filled };
}

/**
 * The weighted average of the current marks.
 *
 * Mirrors `targetAverage` but reads marks with the gauge's clamping rule, so
 * the average shown here always covers exactly the subjects the gauge counts.
 */
export function markAverage(
  subjects: WeightedSubject[],
  marks: Record<string, string>,
) {
  let earned = 0;
  let weight = 0;
  let filled = 0;
  for (const subject of subjects) {
    const mark = normalizedMark(marks[subject.name]);
    if (mark === null) continue;
    earned += mark * subject.weight;
    weight += subject.weight;
    filled += 1;
  }
  return { value: weight ? earned / weight : null, filled };
}

export type MapTargetRow = WeightedSubject & { rank: number; mark: number };

/**
 * Spread a target across courses ordered hardest to easiest.
 *
 * The marks form a straight ramp around the weighted mean rank, so the
 * weighted average stays exactly on target. The ramp is widened as far as the
 * 0–100 range allows, which gives the hardest course the lowest mark and the
 * easiest course the highest mark.
 */
export function mapTargetMarks(
  subjects: WeightedSubject[],
  target: number,
): MapTargetRow[] | null {
  if (!subjects.length || !Number.isFinite(target) || target < 0 || target > 100)
    return null;
  if (
    subjects.some(
      (subject) => !Number.isFinite(subject.weight) || subject.weight <= 0,
    )
  )
    return null;
  const totalWeight = subjects.reduce(
    (sum, subject) => sum + subject.weight,
    0,
  );
  if (totalWeight <= 0) return null;
  if (subjects.length === 1) {
    const only = subjects[0];
    if (!only) return null;
    return [{ ...only, rank: 0, mark: target }];
  }

  const meanRank =
    subjects.reduce(
      (sum, subject, index) => sum + index * subject.weight,
      0,
    ) / totalWeight;
  let spread = Infinity;
  for (let index = 0; index < subjects.length; index += 1) {
    const deviation = index - meanRank;
    if (deviation > 0) spread = Math.min(spread, (100 - target) / deviation);
    else if (deviation < 0) spread = Math.min(spread, target / -deviation);
  }
  if (!Number.isFinite(spread)) spread = 0;

  return subjects.map((subject, index) => ({
    ...subject,
    rank: index,
    mark: Math.min(100, Math.max(0, target + spread * (index - meanRank))),
  }));
}

/** Weighted average of the marks in a MAP plan. */
export function mapTargetAverage(rows: MapTargetRow[]): number | null {
  let earned = 0;
  let weight = 0;
  for (const row of rows) {
    if (
      !Number.isFinite(row.mark) ||
      !Number.isFinite(row.weight) ||
      row.weight <= 0
    )
      continue;
    earned += row.mark * row.weight;
    weight += row.weight;
  }
  return weight ? earned / weight : null;
}

/**
 * Rebalance a MAP plan around marks the student edited.
 *
 * Edited marks stay exactly where the student put them. The remaining courses
 * move together to keep the weighted average on target; if the edits make that
 * impossible, the remaining marks stop at 0 or 100 and the resulting weighted
 * average is allowed to differ so the student can see the real answer.
 */
export function mapTargetMarksWithEdits(
  subjects: WeightedSubject[],
  target: number,
  edits: Record<string, number>,
): MapTargetRow[] | null {
  const base = mapTargetMarks(subjects, target);
  if (!base) return null;

  const fixed = new Map<string, number>();
  for (const row of base) {
    const edited = edits[row.name];
    if (
      typeof edited === "number" &&
      Number.isFinite(edited) &&
      edited >= 0 &&
      edited <= 100
    ) {
      fixed.set(row.name, edited);
    }
  }
  if (!fixed.size) return base;

  const totalWeight = base.reduce((sum, row) => sum + row.weight, 0);
  const marks = new Map(
    base.map((row) => [row.name, fixed.get(row.name) ?? row.mark]),
  );
  const locked = new Set(fixed.keys());
  let adjustable = base
    .filter((row) => !locked.has(row.name))
    .map((row) => row.name);

  while (adjustable.length) {
    const lockedEarned = base.reduce(
      (sum, row) =>
        locked.has(row.name)
          ? sum + (marks.get(row.name) ?? 0) * row.weight
          : sum,
      0,
    );
    const adjustableWeight = base.reduce(
      (sum, row) => (locked.has(row.name) ? sum : sum + row.weight),
      0,
    );
    const adjustableEarned = base.reduce(
      (sum, row) =>
        locked.has(row.name)
          ? sum
          : sum + (marks.get(row.name) ?? 0) * row.weight,
      0,
    );
    const delta =
      (target * totalWeight - lockedEarned - adjustableEarned) /
      adjustableWeight;
    let clamped = false;
    const nextAdjustable: string[] = [];
    for (const name of adjustable) {
      const next = (marks.get(name) ?? 0) + delta;
      if (next < 0) {
        marks.set(name, 0);
        locked.add(name);
        clamped = true;
      } else if (next > 100) {
        marks.set(name, 100);
        locked.add(name);
        clamped = true;
      } else {
        marks.set(name, next);
        nextAdjustable.push(name);
      }
    }
    adjustable = nextAdjustable;
    if (!clamped) break;
  }

  return base.map((row) => ({ ...row, mark: marks.get(row.name) ?? row.mark }));
}

/** Compare only subjects with both marks and targets, using the same weights. */
export function matchedProgress(
  subjects: WeightedSubject[],
  marks: Record<string, string>,
  goals: Record<string, string>,
) {
  let current = 0;
  let target = 0;
  let weight = 0;
  let count = 0;
  for (const subject of subjects) {
    const actual = normalizedMark(marks[subject.name]);
    const goal = validMark(goals[subject.name]);
    if (actual === null || goal === null) continue;
    current += actual * subject.weight;
    target += goal * subject.weight;
    weight += subject.weight;
    count += 1;
  }
  return weight
    ? { actual: current / weight, target: target / weight, count }
    : null;
}

export function dailyEncouragement(
  name: string,
  progress: ReturnType<typeof matchedProgress>,
  day: number,
) {
  const nudges = [
    "Review one difficult topic today and ask for help where you need it.",
    "A focused revision session today is another step toward your goal.",
    "Practise a few questions today, then learn from each mistake.",
    "Keep showing up: small, consistent improvements add up.",
  ];
  const nudge =
    nudges[((day % nudges.length) + nudges.length) % nudges.length];
  if (!progress)
    return `${name}, every day's effort matters. Set your targets and record today's marks. ${nudge}`;
  const gap = progress.target - progress.actual;
  if (gap <= 0)
    return `${name}, you're meeting your targets in the subjects recorded so far. Keep this momentum! ${nudge}`;
  if (gap <= 5)
    return `${name}, you're close—just ${gap.toFixed(1)} percentage points from your target in the subjects recorded so far. You can keep closing that gap! ${nudge}`;
  return `${name}, your current marks are ${gap.toFixed(1)} percentage points below your target in the subjects recorded so far. Your goal is still worth working toward—focus on one improvement today. ${nudge}`;
}
