/**
 * One-time CLA Bridge data migration: Firestore → LMS Core PostgreSQL.
 *
 * The standalone CLA Bridge stored each student under `students/{firebaseUid}`
 * and each saved estimator under `students/{firebaseUid}/estimates/{s4|s5|s6}`.
 * LMS Core keys everything by its own `User.id`, so the two are joined by the
 * Firebase Auth email shared by both projects.
 *
 * Usage:
 *   npm run db:migrate-clabridge            # dry run — prints what would move
 *   npm run db:migrate-clabridge -- --apply # write to PostgreSQL
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

import { PrismaClient } from "../src/generated/prisma/client";

const SOURCE_PROJECT = process.env.CLABRIDGE_PROJECT_ID ?? "clabridge-d7e6f";
const APPLY = process.argv.includes("--apply");
const LEVELS = ["s4", "s5", "s6"] as const;
type SourceLevel = (typeof LEVELS)[number];

type SourceEstimate = Record<string, unknown>;

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

/** Strip Firestore-specific values so a document can be stored as JSON. */
function plainJson(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(plainJson);
  if (
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = plainJson(entry);
  }
  return result;
}

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

function targetMap(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const columns: Record<string, unknown> = {};
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

async function main() {
  console.log(
    `${APPLY ? "Applying" : "Dry run:"} CLA Bridge migration from ${SOURCE_PROJECT} → PostgreSQL\n`,
  );

  const users = await prisma.user.findMany({
    select: { id: true, email: true },
  });
  const byEmail = new Map(
    users.map((user) => [user.email.trim().toLowerCase(), user]),
  );
  const takenUsernames = new Set(
    (
      await prisma.bridgeProfile.findMany({
        where: { username: { not: null } },
        select: { username: true },
      })
    )
      .map((profile) => profile.username?.toLowerCase())
      .filter((name): name is string => Boolean(name)),
  );

  const students = await firestore.collection("students").get();
  const summary = {
    students: students.size,
    matched: 0,
    profiles: 0,
    estimates: 0,
    skippedNoEmail: 0,
    skippedNoUser: 0,
    usernameConflicts: 0,
    errors: 0,
  };

  for (const document of students.docs) {
    const uid = document.id;
    const data = document.data();

    let email = typeof data["email"] === "string" ? data["email"] : "";
    if (!email) {
      try {
        email = (await auth.getUser(uid)).email ?? "";
      } catch {
        email = "";
      }
    }
    if (!email) {
      summary.skippedNoEmail += 1;
      console.warn(`- ${uid}: no email on the student document or Auth user`);
      continue;
    }

    const user = byEmail.get(email.trim().toLowerCase());
    if (!user) {
      summary.skippedNoUser += 1;
      console.warn(`- ${uid} (${email}): no LMS Core user with that email`);
      continue;
    }
    summary.matched += 1;

    const sourceLevel = String(data["level"] ?? "").toLowerCase();
    const level = (LEVELS as readonly string[]).includes(sourceLevel)
      ? (sourceLevel.toUpperCase() as "S4" | "S5" | "S6")
      : null;

    const rawUsername = optionalString(data["username"]);
    let username: string | null = null;
    if (rawUsername) {
      const normalized = rawUsername.trim().replace(/^@/, "").toLowerCase();
      if (takenUsernames.has(normalized)) {
        summary.usernameConflicts += 1;
        console.warn(
          `- ${email}: username @${normalized} is already used in LMS Core; leaving it unset`,
        );
      } else {
        username = normalized;
        takenUsernames.add(normalized);
      }
    }

    if (!level) {
      console.warn(`- ${email}: no valid level saved; skipping profile`);
    } else {
      summary.profiles += 1;
      console.log(
        `- ${email}: ${level}${username ? ` (@${username})` : ""}`,
      );
      if (APPLY) {
        await prisma.bridgeProfile.upsert({
          where: { userId: user.id },
          create: { userId: user.id, level, username },
          update: {
            level,
            ...(username ? { username } : {}),
          },
        });
      }
    }

    for (const sourceKey of LEVELS) {
      const snapshot = await document.ref
        .collection("estimates")
        .doc(sourceKey)
        .get();
      if (!snapshot.exists) continue;
      const estimate = snapshot.data() as SourceEstimate;
      const targetLevel = sourceKey.toUpperCase() as "S4" | "S5" | "S6";

      summary.estimates += 1;
      const marks = stringMap(estimate["marks"]);
      const targets = targetMap(estimate["targets"]);
      const goalTargets = stringMap(estimate["goal_targets"]);
      const combinationCode = optionalString(estimate["combination_code"]) ?? "";
      const overallTarget = optionalString(estimate["overall_target"]);
      const usefulnessRating = optionalRating(estimate["usefulness_rating"]);

      console.log(
        `  ${targetLevel}: ${combinationCode || "no combination"}, ` +
          `${Object.keys(marks).length} marks, ${Object.keys(targets).length} tables`,
      );

      if (APPLY) {
        const payload = {
          combinationCode,
          marks: plainJson(marks) as object,
          targets: plainJson(targets) as object,
          goalTargets: plainJson(goalTargets) as object,
          overallTarget,
          usefulnessRating,
        };
        await prisma.bridgeEstimate.upsert({
          where: { userId_level: { userId: user.id, level: targetLevel } },
          create: { userId: user.id, level: targetLevel, ...payload },
          update: payload,
        });
      }
    }
  }

  console.log("\nSummary");
  console.table(summary);
  if (!APPLY) {
    console.log("\nNothing was written. Re-run with `-- --apply` to migrate.");
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
