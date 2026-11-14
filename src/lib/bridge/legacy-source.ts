/**
 * The shape of the standalone CLA Bridge data, and the rules for reading and
 * staging it.
 *
 * Two callers work with the same Firestore documents: the import script
 * (`scripts/migrate-clabridge.ts`) and the live sync
 * (`src/lib/bridge/legacy-sync.ts`). The rules live here, behind two small
 * interfaces, so the two cannot drift and the rules can be tested without a
 * network or a database.
 *
 * Nothing in this module touches the network or the database.
 */

/** The three levels the standalone app supported, in source spelling. */
export const LEGACY_LEVELS = ["s4", "s5", "s6"] as const;

/** The same levels in the spelling this app stores them in. */
export type LegacyLevel = "S4" | "S5" | "S6";

export type LegacyTargetCells = { got: string; total: string }[];

/** `{ subject: { column: cells } }` — the assessment tables. */
export type LegacyTargets = Record<string, Record<string, LegacyTargetCells>>;

export type LegacyEstimate = {
  combinationCode: string;
  marks: Record<string, string>;
  targets: LegacyTargets;
  goalTargets: Record<string, string>;
  overallTarget: string | null;
  usefulnessRating: number | null;
};

/** One student as the source knows them. */
export type LegacyStudent = {
  /** The Firestore document id (`students/{uid}`). */
  uid: string;
  /** Lowercased; the only join key with LMS Core. */
  email: string;
  /** The name the Firebase Auth user carried, when there is one. */
  displayName: string | null;
  level: LegacyLevel | null;
  /** The nickname the student chose in the standalone app. */
  username: string | null;
  /** Only the levels the student actually saved. */
  estimates: Partial<Record<LegacyLevel, LegacyEstimate>>;
};

/**
 * How a source is read.
 *
 * The caller supplies the I/O — Firestore in production, a fake in a test —
 * and this module decides what the documents mean.
 */
export type LegacySourceReader = {
  /** The ids of every student document in the source. */
  listStudentIds(): Promise<string[]>;
  /** The `students/{uid}` document. */
  studentDocument(uid: string): Promise<{ exists: boolean; data: unknown }>;
  /** The `students/{uid}/estimates/{level}` document. */
  estimateDocument(
    uid: string,
    level: LegacyLevel,
  ): Promise<{ exists: boolean; data: unknown }>;
  /** The Firebase Auth user with that address, if there is one. */
  authUserByEmail(
    email: string,
  ): Promise<{ uid: string; email: string | null; displayName: string | null } | null>;
  /** The Firebase Auth user with that id, if there is one. */
  authUserByUid(
    uid: string,
  ): Promise<{ uid: string; email: string | null; displayName: string | null } | null>;
};

/** One staged row, as far as the rules care. */
export type LegacyStageRow = {
  id: string;
  sourceUid: string;
  email: string | null;
  level: LegacyLevel | null;
  username: string | null;
  displayName: string | null;
  estimates: Partial<Record<LegacyLevel, LegacyEstimate>>;
  claimedAt: Date | null;
};

/** The fields a staged row carries. */
export type LegacyStageFields = {
  email?: string;
  level: LegacyLevel | null;
  username: string | null;
  displayName: string | null;
  estimates: Partial<Record<LegacyLevel, LegacyEstimate>>;
};

/**
 * How staged rows are written.
 *
 * The caller supplies the database calls; this module owns the rules about
 * which row to write and when not to write at all.
 */
export type LegacyStudentTable = {
  findByEmail(email: string): Promise<LegacyStageRow | null>;
  findByUid(sourceUid: string): Promise<LegacyStageRow | null>;
  update(id: string, fields: LegacyStageFields): Promise<void>;
  create(fields: LegacyStageFields & { sourceUid: string }): Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Coerce a stored mark/goal map into string values. */
export function legacyStringMap(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
    else if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = String(entry);
    }
  }
  return result;
}

/** Coerce the stored assessment tables into `{ subject: { column: cells } }`. */
export function legacyTargetMap(value: unknown): LegacyTargets {
  if (!isRecord(value)) return {};
  const result: LegacyTargets = {};
  for (const [subject, table] of Object.entries(value)) {
    if (!isRecord(table)) continue;
    const columns: Record<string, LegacyTargetCells> = {};
    for (const [column, cells] of Object.entries(table)) {
      if (!Array.isArray(cells)) continue;
      columns[column] = cells.map((cell) => ({
        got: isRecord(cell) && typeof cell["got"] === "string" ? cell["got"] : "",
        total:
          isRecord(cell) && typeof cell["total"] === "string"
            ? cell["total"]
            : "",
      }));
    }
    result[subject] = columns;
  }
  return result;
}

/** Reads the level the student picked, whatever spelling the source used. */
export function parseLegacyLevel(value: unknown): LegacyLevel | null {
  const level = String(value ?? "").trim().toLowerCase();
  return (LEGACY_LEVELS as readonly string[]).includes(level)
    ? (level.toUpperCase() as LegacyLevel)
    : null;
}

/**
 * Normalises a nickname the way the standalone app did.
 *
 * The source stored it lowercased and without the `@`; the app keeps that
 * spelling, so a claimed handle looks exactly like the one the student chose.
 */
export function normalizeLegacyUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const username = value.trim().replace(/^@/, "").toLowerCase();
  return username || null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function optionalRating(value: unknown): number | null {
  const rating = typeof value === "number" ? value : Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

/** Reads one saved estimate document. */
export function readLegacyEstimate(data: unknown): LegacyEstimate {
  const estimate = isRecord(data) ? data : {};

  return {
    combinationCode: optionalString(estimate["combination_code"]) ?? "",
    marks: legacyStringMap(estimate["marks"]),
    targets: legacyTargetMap(estimate["targets"]),
    goalTargets: legacyStringMap(estimate["goal_targets"]),
    overallTarget: optionalString(estimate["overall_target"]),
    usefulnessRating: optionalRating(estimate["usefulness_rating"]),
  };
}

/**
 * Reads one student document plus its saved estimates.
 *
 * The caller does the I/O — it has the Firestore document and the estimate
 * documents — and this turns them into the shape the staging table stores.
 */
export function readLegacyStudent(input: {
  uid: string;
  /** The `students/{uid}` document. */
  data: unknown;
  /** The address from the document or the Firebase Auth user. */
  email: string;
  /** The name from the Firebase Auth user. */
  displayName?: string | null;
  /** The raw estimate documents, keyed by level. */
  estimates?: Partial<Record<LegacyLevel, unknown>>;
}): LegacyStudent {
  const data = isRecord(input.data) ? input.data : {};
  const estimates: Partial<Record<LegacyLevel, LegacyEstimate>> = {};

  for (const level of ["S4", "S5", "S6"] as const) {
    const raw = input.estimates?.[level];
    if (raw === undefined) continue;
    estimates[level] = readLegacyEstimate(raw);
  }

  return {
    uid: input.uid,
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName?.trim() || null,
    level: parseLegacyLevel(data["level"]),
    username: normalizeLegacyUsername(data["username"]),
    estimates,
  };
}

/** Reads the three estimate documents of one student. */
async function readLegacyEstimates(
  reader: LegacySourceReader,
  uid: string,
): Promise<Partial<Record<LegacyLevel, unknown>>> {
  const estimates: Partial<Record<LegacyLevel, unknown>> = {};

  for (const level of ["S4", "S5", "S6"] as const) {
    const document = await reader.estimateDocument(uid, level);
    if (document.exists) estimates[level] = document.data;
  }

  return estimates;
}

/**
 * Reads one student from the source.
 *
 * The address comes from the document when it has one and from the Firebase
 * Auth user otherwise; a document with neither cannot be joined to an LMS
 * account, so it is reported as unknown rather than staged.
 */
export async function readLegacyStudentByUid(
  reader: LegacySourceReader,
  uid: string,
): Promise<LegacyStudent | null> {
  const document = await reader.studentDocument(uid);
  if (!document.exists) return null;

  const data = isRecord(document.data) ? document.data : {};
  let email = typeof data["email"] === "string" ? data["email"] : "";
  let displayName = typeof data["displayName"] === "string" ? data["displayName"] : "";

  if (!email || !displayName) {
    const authUser = await reader.authUserByUid(uid);
    if (authUser) {
      if (!email) email = authUser.email ?? "";
      if (!displayName) displayName = authUser.displayName ?? "";
    }
  }

  if (!email.trim()) return null;

  const estimates = await readLegacyEstimates(reader, uid);
  return readLegacyStudent({ uid, data, email, displayName, estimates });
}

/**
 * Reads the student who owns an address.
 *
 * This is the path a returning LMS student takes: their address is known, so
 * the source is asked for that one person rather than swept.
 */
export async function readLegacyStudentByEmail(
  reader: LegacySourceReader,
  email: string,
): Promise<LegacyStudent | null> {
  const address = email.trim().toLowerCase();
  if (!address) return null;

  const authUser = await reader.authUserByEmail(address);
  if (!authUser) return null;

  const student = await readLegacyStudentByUid(reader, authUser.uid);
  if (!student) return null;

  return {
    ...student,
    email: student.email || address,
    displayName: student.displayName ?? authUser.displayName ?? null,
  };
}

/** Reads every student the source knows about. */
export async function readAllLegacyStudents(
  reader: LegacySourceReader,
): Promise<{ students: LegacyStudent[]; withoutAddress: string[] }> {
  const ids = await reader.listStudentIds();
  const students: LegacyStudent[] = [];
  const withoutAddress: string[] = [];

  for (const uid of ids) {
    const student = await readLegacyStudentByUid(reader, uid);
    if (student) students.push(student);
    else withoutAddress.push(uid);
  }

  return { students, withoutAddress };
}

/**
 * Puts one student in the staging table.
 *
 * The rules:
 *
 * - a row that has already been claimed is never touched. The LMS database is
 *   the source of truth once a student has claimed their import;
 * - a row is matched on the address first, so a student who recreated their
 *   clabridge account keeps their import;
 * - a row that has not been claimed yet is refreshed, because the student may
 *   have kept working in the standalone app after the first import.
 */
export async function stageLegacyStudent(
  table: LegacyStudentTable,
  student: LegacyStudent,
): Promise<"staged" | "claimed"> {
  const fields: LegacyStageFields = {
    level: student.level,
    username: student.username,
    displayName: student.displayName,
    estimates: student.estimates,
  };

  const byEmail = await table.findByEmail(student.email);
  if (byEmail) {
    if (byEmail.claimedAt) return "claimed";
    await table.update(byEmail.id, fields);
    return "staged";
  }

  const byUid = await table.findByUid(student.uid);
  if (byUid) {
    if (byUid.claimedAt) return "claimed";
    await table.update(byUid.id, { ...fields, email: student.email });
    return "staged";
  }

  await table.create({ sourceUid: student.uid, email: student.email, ...fields });
  return "staged";
}
