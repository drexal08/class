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
 * The rules for reading and staging the source live in
 * `src/lib/bridge/legacy-source.ts`, shared with the live sync, so the two
 * cannot drift.
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

import {
  readAllLegacyStudents,
  stageLegacyStudent,
  type LegacySourceReader,
  type LegacyStageRow,
  type LegacyStudentTable,
} from "../src/lib/bridge/legacy-source";
import { PrismaClient } from "../src/generated/prisma/client";

const SOURCE_PROJECT = process.env.CLABRIDGE_PROJECT_ID ?? "clabridge-d7e6f";
const APPLY = process.argv.includes("--apply");

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

/** Reads the standalone project. The rules live in `legacy-source.ts`. */
const reader: LegacySourceReader = {
  async listStudentIds() {
    const snapshot = await firestore.collection("students").get();
    return snapshot.docs.map((document) => document.id);
  },
  async studentDocument(uid) {
    const snapshot = await firestore.doc(`students/${uid}`).get();
    return { exists: snapshot.exists, data: snapshot.data() ?? {} };
  },
  async estimateDocument(uid, level) {
    const snapshot = await firestore
      .doc(`students/${uid}/estimates/${level.toLowerCase()}`)
      .get();
    return { exists: snapshot.exists, data: snapshot.data() ?? {} };
  },
  async authUserByEmail(email) {
    try {
      const user = await auth.getUserByEmail(email);
      return {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      };
    } catch {
      return null;
    }
  },
  async authUserByUid(uid) {
    try {
      const user = await auth.getUser(uid);
      return {
        uid: user.uid,
        email: user.email ?? null,
        displayName: user.displayName ?? null,
      };
    } catch {
      return null;
    }
  },
};

/** Writes staged rows. The rules live in `legacy-source.ts`. */
const table: LegacyStudentTable = {
  async findByEmail(email) {
    const row = await prisma.bridgeLegacyStudent.findUnique({
      where: { email },
      select: {
        id: true,
        sourceUid: true,
        email: true,
        level: true,
        username: true,
        displayName: true,
        estimates: true,
        claimedAt: true,
      },
    });
    return row ? (row as LegacyStageRow) : null;
  },
  async findByUid(sourceUid) {
    const row = await prisma.bridgeLegacyStudent.findUnique({
      where: { sourceUid },
      select: {
        id: true,
        sourceUid: true,
        email: true,
        level: true,
        username: true,
        displayName: true,
        estimates: true,
        claimedAt: true,
      },
    });
    return row ? (row as LegacyStageRow) : null;
  },
  async update(id, fields) {
    await prisma.bridgeLegacyStudent.update({
      where: { id },
      data: {
        ...(fields.email === undefined ? {} : { email: fields.email }),
        level: fields.level,
        username: fields.username,
        displayName: fields.displayName,
        estimates: fields.estimates,
      },
    });
  },
  async create(fields) {
    await prisma.bridgeLegacyStudent.create({
      data: {
        sourceUid: fields.sourceUid,
        email: fields.email ?? null,
        level: fields.level,
        username: fields.username,
        displayName: fields.displayName,
        estimates: fields.estimates,
      },
    });
  },
};

/** One-line report for the dry-run output. */
function describeStudent(
  student: { email: string; level: string | null; username: string | null; estimates: object },
  hasAccount: boolean,
): string {
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

  const { students, withoutAddress } = await readAllLegacyStudents(reader);
  const summary = {
    students: students.length + withoutAddress.length,
    staged: 0,
    withAccount: 0,
    withoutAccount: 0,
    skippedNoEmail: withoutAddress.length,
    errors: 0,
  };

  for (const student of students) {
    const hasAccount = accountEmails.has(student.email);
    summary[hasAccount ? "withAccount" : "withoutAccount"] += 1;
    console.log(describeStudent(student, hasAccount));

    if (!APPLY) {
      summary.staged += 1;
      continue;
    }

    try {
      await stageLegacyStudent(table, student);
      summary.staged += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(`  failed to stage ${student.email}:`, error);
    }
  }

  for (const uid of withoutAddress) {
    console.warn(`- ${uid}: no email on the student document or Auth user`);
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
