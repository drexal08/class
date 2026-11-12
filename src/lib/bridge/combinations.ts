/**
 * CLA Bridge subject matrix.
 *
 * Ported from clabridge so the native estimator produces exactly the same
 * weighted report percentages. Keep level-specific extras separate from shared
 * subsidiaries: an S4/S5 addition must never leak into S6 scoring.
 */

export type Combination = {
  code: string;
  cores: string[];
  extras?: { name: string; weight: number }[];
  omitSubs?: string[];
};

export type Level = "s4" | "s5" | "s6";

export type EstimatorSubject = { name: string; weight: number };

export const LEVEL_KEYS = ["s4", "s5", "s6"] as const;

export const S4_S5_SUB_MATH = {
  name: "Subsidiary Mathematics",
  weight: 3,
} as const;

const STREAMS: Combination[] = [
  { code: "MPCB", cores: ["Mathematics", "Physics", "Chemistry", "Biology"] },
  { code: "MPEG", cores: ["Mathematics", "Physics", "Economics", "Geography"] },
  {
    code: "HLPG",
    cores: ["History", "Literature", "Psychology", "Geography"],
    extras: [S4_S5_SUB_MATH],
    // HLPG does not sit English at S4 or S5, so its x3 credits never count.
    omitSubs: ["English"],
  },
];

export const LEVELS: Record<Level, { label: string; combos: Combination[] }> = {
  s4: { label: "Senior 4", combos: STREAMS },
  s5: { label: "Senior 5", combos: STREAMS },
  s6: {
    label: "Senior 6",
    combos: [
      { code: "MPG", cores: ["Mathematics", "Physics", "Geography"] },
      {
        code: "HGL",
        cores: ["History", "Geography", "Literature"],
        extras: [{ name: "Subsidiary Mathematics", weight: 3 }],
      },
      { code: "MCB", cores: ["Mathematics", "Chemistry", "Biology"] },
      {
        code: "PCB",
        cores: ["Physics", "Chemistry", "Biology"],
        extras: [{ name: "Subsidiary Mathematics", weight: 3 }],
      },
      {
        code: "HLP",
        cores: ["History", "Literature", "Psychology"],
        extras: [{ name: "Subsidiary Mathematics", weight: 3 }],
      },
    ],
  },
};

export const SUBSIDIARIES = [
  { name: "Entrepreneurship", weight: 3 },
  { name: "English", weight: 3 },
  { name: "General Studies", weight: 3 },
  { name: "ICT", weight: 2 },
  { name: "Sports", weight: 1 },
];

export const S4_S5_SUBSIDIARIES = SUBSIDIARIES.map((subject) =>
  subject.name === "ICT" ? { ...subject, weight: 3 } : subject,
);

export const S4_S5_LANGUAGES = [
  { name: "French", weight: 3 },
  { name: "Kinyarwanda", weight: 3 },
];

/** The exact subjects the estimator renders for a level and combination. */
export function subjectsFor(
  level: Level,
  combo: Combination,
): EstimatorSubject[] {
  const s4s5 = level === "s4" || level === "s5";
  const omitted = new Set(combo.omitSubs ?? []);
  return [
    ...combo.cores.map((name) => ({ name, weight: 7 })),
    ...(s4s5 ? S4_S5_SUBSIDIARIES : SUBSIDIARIES).filter(
      (subject) => !omitted.has(subject.name),
    ),
    ...(combo.extras ?? []),
    ...(s4s5 ? S4_S5_LANGUAGES : []),
  ];
}

export function isLevel(value: unknown): value is Level {
  return value === "s4" || value === "s5" || value === "s6";
}

export function levelLabel(level: Level): string {
  return LEVELS[level].label;
}

/** Convert the database's uppercase enum into the estimator's lowercase key. */
export function fromBridgeLevel(value: "S4" | "S5" | "S6"): Level {
  return value.toLowerCase() as Level;
}

/** Convert the estimator's key into the database enum. */
export function toBridgeLevel(value: Level): "S4" | "S5" | "S6" {
  return value.toUpperCase() as "S4" | "S5" | "S6";
}
