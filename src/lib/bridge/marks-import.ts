import { LEVELS } from "@/lib/bridge/combinations";
import {
  overallAverage,
  rowsForWeight,
  TARGET_COLUMNS,
  type Cell,
  type SubjectTargets,
} from "@/lib/bridge/target-table";

/** A subject exactly as the estimator renders it (name + report weight). */
export type MarksSubject = { name: string; weight: number };

/** One assessment row scraped from AcademicBridge. */
export type BridgeAssessmentRow = {
  subject: string;
  type: string;
  score: number;
  maxScore: number;
};

/** Payload the AcademicBridge bookmarklet sends to the estimator tab. */
export type BridgeImport = {
  id: string;
  rows: BridgeAssessmentRow[];
  pages: number;
  expectedCount: number | null;
};

/** Stages the bookmarklet reports while it works through AcademicBridge. */
export const IMPORT_PROGRESS_STAGES = [
  "opening",
  "navigating",
  "locating",
  "reading",
  "sending",
  "done",
  "error",
] as const;

export type ImportProgressStage = (typeof IMPORT_PROGRESS_STAGES)[number];

/**
 * Live status posted to the app while the bookmarklet reads AcademicBridge.
 * The estimator shows this so a long page walk never looks stuck.
 */
export type ImportProgress = {
  id: string;
  stage: ImportProgressStage;
  message: string;
  page: number | null;
  totalPages: number | null;
  rows: number;
  expectedCount: number | null;
  sentAt: number;
};

export type TargetColumnKey = (typeof TARGET_COLUMNS)[number]["key"];

export type ImportEntry = { score: number; max: number };

export type ImportGroup = {
  subject: string;
  key: string;
  columns: Partial<Record<TargetColumnKey, ImportEntry[]>>;
};

export type ImportedSubject = {
  subject: string;
  marks: number;
  estimate: number | null;
  counts: Partial<Record<TargetColumnKey, number>>;
};

export type ImportReport = {
  matched: ImportedSubject[];
  unmatched: string[];
  unknown: { type: string; count: number }[];
  collapsed: string[];
  totalRows: number;
  pages: number;
  expectedCount: number | null;
};

export type ImportOutcome = {
  marks: Record<string, string>;
  targets: Record<string, SubjectTargets>;
  report: ImportReport;
};

/**
 * AcademicBridge assessment labels mapped onto the six estimator columns.
 *
 * The bookmarklet sends the raw label from the portal, so this is the single
 * place where a portal label becomes an estimator column.
 */
export function mapAssessmentColumn(type: string): TargetColumnKey | null {
  const raw = String(type ?? "").toLowerCase();
  const compact = raw.replace(/[^a-z0-9]/g, "");
  if (compact.includes("beginning") || compact.includes("bot")) return "BOT";
  // Unit assessments win over the generic "final" rule so labels such as
  // "Final Unit Assessment" land in EUA instead of EOT.
  if (
    compact.includes("endofunit") ||
    compact.includes("unitassessment") ||
    compact.includes("unittest") ||
    compact.includes("unitexam") ||
    compact.includes("eua") ||
    compact.includes("eou") ||
    /unit\d*(?:test|exam|assessment)/.test(compact) ||
    (/\bunit\b/i.test(raw) && /(?:test|exam|assessment)/i.test(raw))
  ) {
    return "EUA";
  }
  if (
    compact.includes("endofterm") ||
    compact.includes("finalterm") ||
    compact.includes("final") ||
    compact.includes("eot")
  ) {
    return "EOT";
  }
  if (
    compact.includes("midterm") ||
    compact.includes("mid") ||
    compact.includes("mt") ||
    compact.startsWith("mot")
  ) {
    return "MT";
  }
  if (compact.includes("group") || compact.includes("gw")) return "GW";
  if (compact.includes("continuousassessment") || compact.includes("cat"))
    return "CAT";
  if (
    compact.includes("assignment") ||
    compact.includes("homework") ||
    compact.includes("classwork") ||
    compact.includes("exercise") ||
    compact.includes("quiz") ||
    compact.includes("project") ||
    compact.includes("presentation") ||
    compact.includes("essay") ||
    compact.includes("portfolio") ||
    compact.includes("practical") ||
    compact.includes("test") ||
    compact.includes("exam") ||
    compact.includes("assessment")
  ) {
    return "CAT";
  }
  return null;
}

/**
 * AcademicBridge stores the official course names, which often differ from the
 * short labels the estimator renders ("Information and Communication
 * Technology" vs "ICT"). Every S4/S5 subsidiary has such a long form, so an
 * import that only matched exact short names silently skipped those courses.
 */
const SUBJECT_ALIASES = new Map([
  // Sports
  ["physical education", "sports"],
  ["physical ed", "sports"],
  ["physical education and sports", "sports"],
  ["physical education and sport", "sports"],
  ["physical and health education", "sports"],
  ["pe", "sports"],
  ["p e", "sports"],
  ["ep", "sports"],
  ["pes", "sports"],
  ["p e s", "sports"],
  ["phe", "sports"],
  ["sport", "sports"],
  // ICT
  ["information and communication technology", "ict"],
  ["information communication technology", "ict"],
  ["information and communication technologies", "ict"],
  ["information technology", "ict"],
  ["computer science", "ict"],
  ["computer studies", "ict"],
  ["computer", "ict"],
  ["subsidiary ict", "ict"],
  ["ict subsidiary", "ict"],
  // Subsidiary Mathematics
  // AcademicBridge lists the S4 HLPG lesson as "Basic Mathematics".
  ["basic mathematics", "subsidiary mathematics"],
  ["basic maths", "subsidiary mathematics"],
  ["basic math", "subsidiary mathematics"],
  ["subsidiary maths", "subsidiary mathematics"],
  ["subsidiary math", "subsidiary mathematics"],
  ["mathematics subsidiary", "subsidiary mathematics"],
  ["maths subsidiary", "subsidiary mathematics"],
  ["sub mathematics", "subsidiary mathematics"],
  ["sub maths", "subsidiary mathematics"],
  ["sub math", "subsidiary mathematics"],
  // General Studies
  ["gscs", "general studies"],
  ["general studies and communication skills", "general studies"],
  ["general and religious studies", "general studies"],
  ["general religious studies", "general studies"],
  ["general and religious education", "general studies"],
  // A Senior 5 teacher entered "Genera and Religious Studies" on the
  // AcademicBridge portal. The typo must still reach General Studies.
  ["genera and religious studies", "general studies"],
  ["genera religious studies", "general studies"],
  ["genera and religious education", "general studies"],
  // Languages
  ["ikinyarwanda", "kinyarwanda"],
  ["francais", "french"],
]);

function aliasSubject(normalized: string): string {
  const direct = SUBJECT_ALIASES.get(normalized);
  if (direct) return direct;
  // "General and Religious Studies" — and the Senior 5 typo "Genera and
  // Religious Studies" — are both the estimator's General Studies.
  if (
    /^(?:genera|general)(?: and)? religious (?:studies|education)$/.test(
      normalized,
    )
  ) {
    return "general studies";
  }
  if (/\bphysical (?:and health )?education\b/.test(normalized))
    return "sports";
  if (/\bsports?\b/.test(normalized)) return "sports";
  if (
    /\b(?:information (?:and )?communication technolog(?:y|ies)|computer (?:science|studies))/.test(
      normalized,
    )
  ) {
    return "ict";
  }
  if (/^(?:subsidiary|sub) maths?(?:ematics)?$/.test(normalized)) {
    return "subsidiary mathematics";
  }
  if (/^maths?(?:ematics)? subsidiary$/.test(normalized)) {
    return "subsidiary mathematics";
  }
  return normalized;
}

/**
 * Class prefixes AcademicBridge puts in front of a course name, such as
 * "S5 MPCB Mathematics" or "S6 MPG General Studies".
 *
 * Every combination code is stripped rather than a hand-written list, because
 * Senior 6 uses different codes from Senior 4 and 5 and a level may gain a
 * combination later.
 */
const CLASS_PREFIX_PATTERN = new RegExp(
  `\\b(?:s[456]|${[
    ...new Set(
      Object.values(LEVELS).flatMap((level) =>
        level.combos.map((combo) => combo.code.toLowerCase()),
      ),
    ),
  ].join("|")})\\b`,
  "g",
);

/** Lowercase key used to line source subjects up with estimator subjects. */
export function normalizeSubjectName(value: string): string {
  const base = String(value ?? "").split("(")[0] ?? "";
  const normalized = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    // Drop class prefixes such as "S5 MPCB Mathematics".
    .replace(CLASS_PREFIX_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
  return aliasSubject(normalized);
}

function subjectMatchScore(
  targetKey: string,
  sourceKey: string,
): number | null {
  if (!targetKey || !sourceKey) return null;
  if (targetKey === sourceKey) return 1000 + targetKey.length;
  const targetWords = targetKey.split(" ");
  const sourceWords = sourceKey.split(" ");

  // "Mathematics Subsidiary" and "Subsidiary Mathematics" are the same course.
  if (targetWords.length > 1 && targetWords.length === sourceWords.length) {
    const sortedTarget = [...targetWords].sort().join(" ");
    const sortedSource = [...sourceWords].sort().join(" ");
    if (sortedTarget === sortedSource) return 950 + targetKey.length;
  }

  if (
    sourceWords.length > targetWords.length &&
    targetWords.every((word, index) => sourceWords[index] === word)
  ) {
    return 800 + targetKey.length;
  }
  // Short keys are too easy to hit by accident ("pe" inside "performing arts").
  if (sourceKey.length >= 4 && targetKey.startsWith(sourceKey))
    return 700 + sourceKey.length;
  if (targetKey.length >= 4 && sourceKey.startsWith(targetKey))
    return 600 + targetKey.length;
  return null;
}

/** Pick the estimator subject a source label belongs to, or null if none fits. */
export function matchSubject(
  sourceName: string,
  subjects: MarksSubject[],
): MarksSubject | null {
  const key = normalizeSubjectName(sourceName);
  let best: MarksSubject | null = null;
  let bestScore = 0;
  for (const subject of subjects) {
    const score = subjectMatchScore(normalizeSubjectName(subject.name), key);
    if (score === null || score <= bestScore) continue;
    best = subject;
    bestScore = score;
  }
  return best;
}

/** Group assessment rows by subject and estimator column. */
export function buildImportGroups(rows: BridgeAssessmentRow[]): {
  groups: ImportGroup[];
  unknown: { type: string; count: number }[];
} {
  const groups = new Map<string, ImportGroup>();
  const unknown = new Map<string, number>();

  for (const row of rows) {
    const column = mapAssessmentColumn(row.type);
    if (!column) {
      unknown.set(row.type, (unknown.get(row.type) ?? 0) + 1);
      continue;
    }
    const key = normalizeSubjectName(row.subject);
    let group = groups.get(key);
    if (!group) {
      group = {
        subject: (row.subject.split("(")[0] ?? "").trim(),
        key,
        columns: {},
      };
      groups.set(key, group);
    }
    (group.columns[column] ??= []).push({
      score: row.score,
      max: row.maxScore,
    });
  }

  return {
    groups: [...groups.values()],
    unknown: [...unknown.entries()].map(([type, count]) => ({ type, count })),
  };
}

function formatMark(value: number): string {
  if (!Number.isFinite(value)) return "";
  return String(Math.max(0, Math.round(value * 100) / 100));
}

function clampRatio(value: number): number {
  return Math.min(Math.max(value, 0), 1);
}

/**
 * Build the target table for one subject. Extra marks collapse into a single
 * averaged row, exactly as the extension does when the estimator has fewer
 * rows than AcademicBridge has entries.
 */
export function buildSubjectTable(
  group: ImportGroup,
  rowCount: number,
): SubjectTargets {
  const rows = Math.max(1, Math.floor(rowCount));
  const table: SubjectTargets = {};
  for (const column of TARGET_COLUMNS) {
    const entries = group.columns[column.key] ?? [];
    if (!entries.length) continue;
    const cells: Cell[] = Array.from({ length: rows }, () => ({
      got: "",
      total: "",
    }));
    if (entries.length <= rows) {
      entries.forEach((entry, index) => {
        cells[index] = {
          got: formatMark(entry.score),
          total: formatMark(entry.max),
        };
      });
    } else {
      const ratio =
        entries.reduce(
          (sum, entry) => sum + clampRatio(entry.score / entry.max),
          0,
        ) / entries.length;
      cells[0] = { got: formatMark(ratio * 100), total: "100" };
    }
    table[column.key] = cells;
  }
  return table;
}

/**
 * Turn a bookmarklet payload into the marks and target tables this level needs.
 * Matched subjects are authoritative: their mark is replaced and every imported
 * column overwrites the matching table column. Columns absent from the import
 * are preserved, and the mark is derived from the merged table so a projected
 * column the student entered by hand still counts.
 */
export function importMarks(
  input: BridgeImport,
  subjects: MarksSubject[],
  existingTargets: Record<string, SubjectTargets> = {},
): ImportOutcome {
  const { groups, unknown } = buildImportGroups(input.rows);
  const merged = new Map<string, { subject: MarksSubject; group: ImportGroup }>();
  const unmatched: string[] = [];

  for (const group of groups) {
    const subject = matchSubject(group.subject, subjects);
    if (!subject) {
      if (!unmatched.includes(group.subject)) unmatched.push(group.subject);
      continue;
    }
    const existing = merged.get(subject.name);
    if (!existing) {
      merged.set(subject.name, {
        subject,
        group: {
          subject: subject.name,
          key: group.key,
          columns: { ...group.columns },
        },
      });
      continue;
    }
    for (const [column, entries] of Object.entries(group.columns) as [
      TargetColumnKey,
      ImportEntry[],
    ][]) {
      (existing.group.columns[column] ??= []).push(...entries);
    }
  }

  const marks: Record<string, string> = {};
  const targets: Record<string, SubjectTargets> = {};
  const matched: ImportedSubject[] = [];
  const collapsed: string[] = [];

  for (const { subject, group } of merged.values()) {
    const rowCount = rowsForWeight(subject.weight);
    const table = buildSubjectTable(group, rowCount);
    const mergedTable: SubjectTargets = {
      ...existingTargets[subject.name],
      ...table,
    };
    const overall = overallAverage(mergedTable);
    const estimate = overall ? Math.min(overall.value, 100) : null;
    if (estimate !== null)
      marks[subject.name] = String(Math.round(estimate * 10) / 10);
    targets[subject.name] = table;

    const counts: Partial<Record<TargetColumnKey, number>> = {};
    let markCount = 0;
    for (const column of TARGET_COLUMNS) {
      const entries = group.columns[column.key] ?? [];
      if (!entries.length) continue;
      counts[column.key] = entries.length;
      markCount += entries.length;
      if (entries.length > rowCount) {
        collapsed.push(
          `${subject.name} ${column.key}: ${entries.length} marks averaged into ${rowCount} rows`,
        );
      }
    }
    matched.push({
      subject: subject.name,
      marks: markCount,
      estimate,
      counts,
    });
  }

  matched.sort((a, b) => a.subject.localeCompare(b.subject));
  unmatched.sort((a, b) => a.localeCompare(b));

  return {
    marks,
    targets,
    report: {
      matched,
      unmatched,
      unknown,
      collapsed,
      totalRows: input.rows.length,
      pages: input.pages,
      expectedCount: input.expectedCount,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeImport(
  message: Record<string, unknown>,
): BridgeImport | null {
  const id = typeof message["id"] === "string" ? message["id"].slice(0, 80) : "";
  if (!id) return null;

  const rawRows = Array.isArray(message["rows"]) ? message["rows"] : [];
  const rows: BridgeAssessmentRow[] = [];
  for (const raw of rawRows.slice(0, 5000)) {
    if (!isRecord(raw)) continue;
    const subject =
      typeof raw["subject"] === "string"
        ? raw["subject"].trim().slice(0, 120)
        : "";
    const type =
      typeof raw["type"] === "string"
        ? raw["type"].trim().slice(0, 120)
        : "";
    const score = raw["score"];
    const maxScore = raw["maxScore"];
    if (!subject || !type) continue;
    if (typeof score !== "number" || !Number.isFinite(score) || score < 0)
      continue;
    if (
      typeof maxScore !== "number" ||
      !Number.isFinite(maxScore) ||
      maxScore <= 0
    )
      continue;
    rows.push({ subject, type, score, maxScore });
  }
  if (!rows.length) return null;

  const pages = message["pages"];
  const expected = message["expectedCount"];
  return {
    id,
    rows,
    pages:
      typeof pages === "number" && Number.isFinite(pages) && pages > 0
        ? Math.floor(pages)
        : 1,
    expectedCount:
      typeof expected === "number" &&
      Number.isFinite(expected) &&
      expected >= 0
        ? Math.floor(expected)
        : null,
  };
}

/** Validate a message posted by the AcademicBridge bookmarklet. */
export function parseBridgeImportMessage(data: unknown): BridgeImport | null {
  if (!isRecord(data)) return null;
  if (data["type"] !== "cla-bridge:import" || data["version"] !== 1)
    return null;
  return normalizeImport(data);
}

function optionalCount(value: unknown, minimum: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum)
    return null;
  return Math.floor(value);
}

/** Validate a live progress message posted while the bookmarklet is reading. */
export function parseImportProgressMessage(
  data: unknown,
): ImportProgress | null {
  if (!isRecord(data)) return null;
  if (data["type"] !== "cla-bridge:progress" || data["version"] !== 1)
    return null;

  const id = typeof data["id"] === "string" ? data["id"].slice(0, 80) : "";
  const stage = data["stage"];
  const message =
    typeof data["message"] === "string"
      ? data["message"].trim().slice(0, 240)
      : "";
  if (!id || !message) return null;
  if (
    typeof stage !== "string" ||
    !(IMPORT_PROGRESS_STAGES as readonly string[]).includes(stage)
  ) {
    return null;
  }

  const sentAt = data["sentAt"];
  return {
    id,
    stage: stage as ImportProgressStage,
    message,
    page: optionalCount(data["page"], 1),
    totalPages: optionalCount(data["totalPages"], 1),
    rows: optionalCount(data["rows"], 0) ?? 0,
    expectedCount: optionalCount(data["expectedCount"], 0),
    sentAt:
      typeof sentAt === "number" && Number.isFinite(sentAt)
        ? sentAt
        : Date.now(),
  };
}
