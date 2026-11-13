/**
 * One-time CLA Bridge data import: Firestore → LMS Core PostgreSQL.
 *
 * The standalone CLA Bridge stored each student under `students/{firebaseUid}`
 * and each saved estimator under `students/{firebaseUid}/estimates/{s4|s5|s6}`.
 * It also ran on its own Firebase project, so those UIDs are not LMS Core
 * `User.id`s and cannot sign in here.
 *
 * This script therefore *stages* every source document in
 * `BridgeLegacyStudent`, keyed by lowercased email. Nothing is written to
 * `BridgeProfile` / `BridgeEstimate` here: `claimLegacyBridgeData` attaches a
 * staged row to the student's account the first time they open `/bridge`, which
 * is also when their `User` row is guaranteed to exist. Students who have not
 * registered yet keep their nickname, level and marks waiting.
 *
 * Usage:
 *   npm run db:migrate-clabridge            # dry run — prints what would move
 *   npm run db:migrate-clabridge -- --apply # write the staging table
 *
 * Credentials: set CLABRIDGE_SERVICE_ACCOUNT_KEY (raw or base64 JSON) or
 * CLABRIDGE_SERVICE_ACCOUNT_FILE to a service-account JSON file for the
 * clabridge-d7e6f project. The LMS database comes from DATABASE_URL.
 */

import "dotenv/config";

import { readFileSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import type { ServiceAccount } from "firebase-admin/app";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

import { PrismaClient } from "../src/generated/prisma/client";

const SOURCE_PROJECT = process.env.CLABRIDGE_PROJECT_ID ?? "clabridge-d7e6f";
const APPLY = process.argv.includes("--apply");
const LEVELS = ["s4", "s5", "s6"] as const;

type SourceEstimate = Record<string, unknown>;

/** One staged estimate, in the shape `claimLegacyBridgeData` reads back. */
type StagedEstimateJson = {
  combinationCode: string;
  marks: Record<string, string>;
  targets: Record<string, Record<string, TargetCells>>;
  goalTargets: Record<string, string>;
  overallTarget: string | null;
  usefulnessRating: number | null;
};

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL is not set. Add it to .env before running the migration.",
  );
  process.exit(1);
}

function loadServiceAccount(): ServiceAccount {
  const inline = process.env.CLABRIDGE_SERVICE_ACCOUNT_KEY;
  const file = process.env.CLABRIDGE_SERVICE_ACCOUNT_FILE;
  const raw = inline
    ? inline.trim().startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8")
    : file
      ? readFileSync(file, "utf8")
      : "";

  if (!raw) {
    console.error(
      "No CLA Bridge credentials. Set CLABRIDGE_SERVICE_ACCOUNT_KEY or CLABRIDGE_SERVICE_ACCOUNT_FILE.",
    );
    process.exit(1);
  }

  // Service-account files use snake_case; firebase-admin's `cert()` wants the
  // camelCase shape, so map explicitly instead of casting the raw JSON.
  const parsed = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };
  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    console.error(
      "The service account JSON is missing project_id, client_email or private_key.",
    );
    process.exit(1);
  }
  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
}

const app = getApps().find((item) => item.name === "clabridge-migration")
  ? getApps().find((item) => item.name === "clabridge-migration")!
  : initializeApp(
      {
        credential: cert(loadServiceAccount()),
        projectId: SOURCE_PROJECT,
      },
      "clabridge-migration",
    );

const firestore = getFirestore(app);
const auth = getAuth(app);

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/** Coerce a stored mark/goal map into string values. */
function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") result[key] = entry;
    else if (typeof entry === "number" && Number.isFinite(entry)) {
      result[key] = String(entry);
    }
  }
  return result;
}

type TargetCells = { got: string; total: string }[];

function targetMap(
  value: unknown,
): Record<string, Record<string, TargetCells>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, Record<string, TargetCells>> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const columns: Record<string, TargetCells> = {};
    for (const [column, cells] of Object.entries(entry)) {
      if (!Array.isArray(cells)) continue;
      columns[column] = cells.map((cell) => {
        if (!cell || typeof cell !== "object") return { got: "", total: "" };
        const row = cell as { got?: unknown; total?: unknown };
        return {
          got: typeof row.got === "string" ? row.got : "",
          total: typeof row.total === "string" ? row.total : "",
        };
      });
    }
    result[key] = columns;
  }
  return result;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function optionalRating(value: unknown): number | null {
  const rating = typeof value === "number" ? value : Number(value);
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null;
}

/** One staged student, in the shape `BridgeLegacyStudent` stores. */
type SourceStudent = {
  uid: string;
  email: string;
  level: "S4" | "S5" | "S6" | null;
  username: string | null;
  estimates: Record<string, StagedEstimateJson>;
};

/**
 * Reads one Firestore student document into the shape we stage.
 *
 * Returns null when the source has no email to join on, neither on the
 * document nor on the Firebase Auth user.
 */
async function readStudent(
  document: QueryDocumentSnapshot,
): Promise<SourceStudent | null> {
  const data = document.data();

  let email = typeof data["email"] === "string" ? data["email"] : "";
  if (!email) {
    try {
      email = (await auth.getUser(document.id)).email ?? "";
    } catch {
      email = "";
    }
  }
  if (!email) return null;

  const sourceLevel = String(data["level"] ?? "").toLowerCase();
  const level = (LEVELS as readonly string[]).includes(sourceLevel)
    ? (sourceLevel.toUpperCase() as "S4" | "S5" | "S6")
    : null;

  const rawUsername = optionalString(data["username"]);
  const username = rawUsername
    ? rawUsername.trim().replace(/^@/, "").toLowerCase()
    : null;

  const estimates: Record<string, StagedEstimateJson> = {};
  for (const sourceKey of LEVELS) {
    const snapshot = await document.ref
      .collection("estimates")
      .doc(sourceKey)
      .get();
    if (!snapshot.exists) continue;

    const estimate = snapshot.data() as SourceEstimate;
    estimates[sourceKey.toUpperCase()] = {
      combinationCode: optionalString(estimate["combination_code"]) ?? "",
      marks: stringMap(estimate["marks"]),
      targets: targetMap(estimate["targets"]),
      goalTargets: stringMap(estimate["goal_targets"]),
      overallTarget: optionalString(estimate["overall_target"]),
      usefulnessRating: optionalRating(estimate["usefulness_rating"]),
    };
  }

  return {
    uid: document.id,
    email: email.trim().toLowerCase(),
    level,
    username,
    estimates,
  };
}

/** Writes one staged student. Safe to re-run: it upserts on the source uid. */
async function stageStudent(student: SourceStudent): Promise<void> {
  await prisma.bridgeLegacyStudent.upsert({
    where: { sourceUid: student.uid },
    create: {
      sourceUid: student.uid,
      email: student.email,
      level: student.level,
      username: student.username,
      estimates: student.estimates,
    },
    update: {
      email: student.email,
      level: student.level,
      username: student.username,
      estimates: student.estimates,
    },
  });
}

/** One-line report for the dry-run output. */
function describeStudent(student: SourceStudent, hasAccount: boolean): string {
  const levels = Object.keys(student.estimates);
  return (
    `${student.email}: ${student.level ?? "no level"}` +
    `${student.username ? ` (@${student.username})` : ""}, ` +
    `${levels.length} estimate${levels.length === 1 ? "" : "s"}` +
    `${levels.length ? ` [${levels.join(", ")}]` : ""}` +
    `${hasAccount ? "" : " — no LMS account yet"}`
  );
}

async function main() {
  console.log(
    `${APPLY ? "Applying" : "Dry run:"} CLA Bridge import from ${SOURCE_PROJECT} → BridgeLegacyStudent\n`,
  );

  const accountEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((user) =>
      user.email.trim().toLowerCase(),
    ),
  );

  const claimedUids = new Set(
    (
      await prisma.bridgeLegacyStudent.findMany({
        select: { sourceUid: true, claimedAt: true },
        where: { claimedAt: { not: null } },
      })
    ).map((row) => row.sourceUid),
  );

  const students = await firestore.collection("students").get();
  const summary = {
    students: students.size,
    staged: 0,
    withAccount: 0,
    withoutAccount: 0,
    alreadyClaimed: 0,
    skippedNoEmail: 0,
    errors: 0,
  };

  for (const document of students.docs) {
    if (claimedUids.has(document.id)) {
      summary.alreadyClaimed += 1;
      continue;
    }

    const student = await readStudent(document);
    if (!student) {
      summary.skippedNoEmail += 1;
      console.warn(
        `- ${document.id}: no email on the student document or Auth user`,
      );
      continue;
    }

    const hasAccount = accountEmails.has(student.email);
    summary[hasAccount ? "withAccount" : "withoutAccount"] += 1;
    console.log(describeStudent(student, hasAccount));

    if (!APPLY) {
      summary.staged += 1;
      continue;
    }

    try {
      await stageStudent(student);
      summary.staged += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`  failed to stage ${student.email}:`, error);
    }
  }

  console.log("\nSummary");
  console.table(summary);
  if (!APPLY) {
    console.log("\nNothing was written. Re-run with `-- --apply` to stage.");
  } else {
    console.log(
      "\nStaged rows are claimed automatically the first time each student opens /bridge.",
    );
  }
}

main()
  .catch((error) => {
    console.error("\nMigration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
