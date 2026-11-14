import "server-only";

import { readFileSync } from "node:fs";

import type { App, ServiceAccount } from "firebase-admin/app";

import {
  readAllLegacyStudents,
  readLegacyStudentByEmail,
  stageLegacyStudent,
  type LegacySourceReader,
  type LegacyStageRow,
  type LegacyStudentTable,
} from "@/lib/bridge/legacy-source";
import { prisma } from "@/lib/prisma";

/**
 * Pulls CLA Bridge imports from the standalone app's Firebase project.
 *
 * The standalone app ran on its own Firebase project, so a student's old UID
 * is not their `User.id` here and the only join key is the email address.
 * The import therefore *stages* every source document in
 * `BridgeLegacyStudent`; `src/lib/bridge/claim.ts` attaches a staged row to
 * the student's account the first time they open `/bridge`.
 *
 * Two ways in:
 *
 * - `pullLegacyStudentByEmail` is called when a student opens the estimator
 *   and nothing is staged for them yet. That is the automatic path: a
 *   student who signs up after the original import still arrives with their
 *   nickname and their marks, without anyone running a script.
 * - `pullAllLegacyStudents` sweeps the whole source and is used by the
 *   scheduled job and the admin console.
 *
 * The source is optional. Without credentials the pull is skipped and the
 * app behaves exactly as it did before.
 */

const LEGACY_APP_NAME = "clabridge-legacy";

/** The standalone app's Firebase project. */
export function legacySourceProject(): string {
  return process.env.CLABRIDGE_PROJECT_ID ?? "clabridge-d7e6f";
}

/** Whether this deployment can read the standalone app's data. */
export function isLegacyBridgeConfigured(): boolean {
  return Boolean(
    process.env.CLABRIDGE_SERVICE_ACCOUNT_KEY ||
      process.env.CLABRIDGE_SERVICE_ACCOUNT_FILE,
  );
}

export type PullOutcome =
  /** The student was staged and is ready to claim. */
  | "staged"
  /** The student already claimed an import; nothing was touched. */
  | "claimed"
  /** The source has no record for this address. */
  | "unknown"
  /** This deployment has no credentials for the source. */
  | "disabled"
  /** The source could not be read. */
  | "failed";

export type PullSummary = {
  scanned: number;
  staged: number;
  claimed: number;
  withoutAddress: number;
  errors: number;
  disabled: boolean;
};

/**
 * Addresses known to have no record in the source.
 *
 * The pull runs when a student opens the estimator, so a student who never
 * used the standalone app would otherwise pay for a lookup on every visit.
 * The entry is forgotten after a while, in case they sign up for clabridge
 * later and come back.
 */
const NO_RECORD_TTL_MS = 10 * 60 * 1000;
const noRecordCache = new Map<string, number>();

function recentlyChecked(email: string): boolean {
  const checkedAt = noRecordCache.get(email);
  if (!checkedAt) return false;
  if (Date.now() - checkedAt > NO_RECORD_TTL_MS) {
    noRecordCache.delete(email);
    return false;
  }
  return true;
}

/**
 * The Firebase Admin app for the standalone project.
 *
 * A second app instance, named so it cannot be confused with the app's own
 * Firebase project. The SDK is imported dynamically so a deployment without
 * credentials never loads it.
 */
async function getLegacyApp(): Promise<App | null> {
  if (!isLegacyBridgeConfigured()) return null;

  const serviceAccount = parseLegacyServiceAccount();
  if (!serviceAccount) return null;

  const { cert, getApp, getApps, initializeApp } = await import(
    "firebase-admin/app"
  );

  const existing = getApps().find((app) => app.name === LEGACY_APP_NAME);
  if (existing) return getApp(LEGACY_APP_NAME);

  return initializeApp(
    { credential: cert(serviceAccount), projectId: legacySourceProject() },
    LEGACY_APP_NAME,
  );
}

/**
 * Accepts the service account as raw JSON, base64 or a path to the file.
 *
 * The file form only works where the app runs on a machine with that file —
 * a laptop or a worker — but it keeps the credentials out of shell history
 * and out of the environment.
 */
function parseLegacyServiceAccount(): ServiceAccount | null {
  const inline = process.env.CLABRIDGE_SERVICE_ACCOUNT_KEY;
  const file = process.env.CLABRIDGE_SERVICE_ACCOUNT_FILE;

  let raw = "";
  if (inline) {
    raw = inline.trim().startsWith("{")
      ? inline
      : Buffer.from(inline, "base64").toString("utf8");
  } else if (file) {
    try {
      raw = readFileSync(file, "utf8");
    } catch (error) {
      console.error(
        "[bridge] Could not read CLABRIDGE_SERVICE_ACCOUNT_FILE",
        error,
      );
      return null;
    }
  }

  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      projectId?: string;
      client_email?: string;
      clientEmail?: string;
      private_key?: string;
      privateKey?: string;
    };

    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = (parsed.private_key ?? parsed.privateKey)?.replace(
      /\\n/g,
      "\n",
    );

    if (!projectId || !clientEmail || !privateKey) {
      console.error(
        "[bridge] The CLA Bridge service account is missing project_id, client_email or private_key",
      );
      return null;
    }

    return { projectId, clientEmail, privateKey };
  } catch (error) {
    console.error("[bridge] The CLA Bridge service account is not valid JSON", error);
    return null;
  }
}

/** Reads the standalone project through the shared rules. */
async function getSourceReader(): Promise<LegacySourceReader | null> {
  const app = await getLegacyApp();
  if (!app) return null;

  const { getFirestore } = await import("firebase-admin/firestore");
  const { getAuth } = await import("firebase-admin/auth");

  const firestore = getFirestore(app);
  const auth = getAuth(app);

  return {
    async listStudentIds() {
      const snapshot = await firestore.collection("students").get();
      return snapshot.docs.map((document) => document.id);
    },
    async studentDocument(uid) {
      const snapshot = await firestore.doc(`students/${uid}`).get();
      return {
        exists: snapshot.exists,
        data: snapshot.data() ?? {},
      };
    },
    async estimateDocument(uid, level) {
      const snapshot = await firestore
        .doc(`students/${uid}/estimates/${level.toLowerCase()}`)
        .get();
      return {
        exists: snapshot.exists,
        data: snapshot.data() ?? {},
      };
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
}

/** Writes staged rows through the shared rules. */
function getStageTable(): LegacyStudentTable {
  return {
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
}

/**
 * Pulls one student's clabridge record by address.
 *
 * This is what makes the import automatic: a student who signs up with the
 * address they used in the standalone app finds their nickname and their
 * marks waiting the first time they open the estimator.
 */
export async function pullLegacyStudentByEmail(
  email: string,
): Promise<PullOutcome> {
  const address = email.trim().toLowerCase();
  if (!address) return "unknown";

  const reader = await getSourceReader();
  if (!reader) return "disabled";

  if (recentlyChecked(address)) return "unknown";

  try {
    const student = await readLegacyStudentByEmail(reader, address);
    if (!student) {
      noRecordCache.set(address, Date.now());
      return "unknown";
    }

    const outcome = await stageLegacyStudent(getStageTable(), student);
    if (outcome === "staged") noRecordCache.delete(address);
    return outcome;
  } catch (error) {
    console.error("[bridge] Could not pull a clabridge record", error);
    return "failed";
  }
}

/**
 * Sweeps the whole source and stages everything that is not staged yet.
 *
 * Used by the scheduled job and by the admin console. A student who already
 * claimed their import is left alone: the LMS database is the source of truth
 * from that point on.
 */
export async function pullAllLegacyStudents(): Promise<PullSummary> {
  const summary: PullSummary = {
    scanned: 0,
    staged: 0,
    claimed: 0,
    withoutAddress: 0,
    errors: 0,
    disabled: false,
  };

  const reader = await getSourceReader();
  if (!reader) {
    summary.disabled = true;
    return summary;
  }

  const { students, withoutAddress } = await readAllLegacyStudents(reader);
  summary.scanned = students.length + withoutAddress.length;
  summary.withoutAddress = withoutAddress.length;

  const table = getStageTable();
  for (const student of students) {
    try {
      const outcome = await stageLegacyStudent(table, student);
      if (outcome === "staged") summary.staged += 1;
      else summary.claimed += 1;
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[bridge] Could not stage the clabridge record for ${student.email}`,
        error,
      );
    }
  }

  return summary;
}
