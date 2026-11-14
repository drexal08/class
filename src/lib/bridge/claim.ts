import "server-only";

import type { BridgeLevel, Prisma } from "@/generated/prisma/client";
import { pullLegacyStudentByEmail } from "@/lib/bridge/legacy-sync";
import { prisma } from "@/lib/prisma";

/**
 * Attaches a staged clabridge student to their LMS Core account.
 *
 * The standalone CLA Bridge ran on a different Firebase project, so a student's
 * old UID is not their `User.id` here. `scripts/migrate-clabridge.ts` parks
 * every source document in `BridgeLegacyStudent` keyed by email; this function
 * moves that row into the live tables the first time the student opens
 * `/bridge`, which is also when they are guaranteed to have a `User` row.
 *
 * A student who signs up after the original import has nothing staged yet, so
 * their clabridge record is pulled on the spot. That is what makes the import
 * automatic: the student arrives with their nickname and their marks without
 * anyone running a script.
 *
 * The claim is idempotent and never overwrites an estimate the student has
 * already started editing here. A failure is logged and swallowed: a missing
 * import must not make the estimator unreachable.
 */

const LEVELS = ["S4", "S5", "S6"] as const;

type Cell = { got: string; total: string };
type TargetTable = Record<string, Cell[]>;

type StagedEstimate = {
  level: BridgeLevel;
  combinationCode: string;
  marks: Record<string, string>;
  targets: Record<string, TargetTable>;
  goalTargets: Record<string, string>;
  overallTarget: string | null;
  usefulnessRating: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringMap(value: unknown): Record<string, string> {
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

function targetMap(value: unknown): Record<string, TargetTable> {
  if (!isRecord(value)) return {};
  const result: Record<string, TargetTable> = {};
  for (const [subject, table] of Object.entries(value)) {
    if (!isRecord(table)) continue;
    const columns: TargetTable = {};
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

/**
 * Returns the handle if nobody owns it, otherwise null.
 *
 * Never take a handle from another account: the estimates still land and an
 * admin can resolve the nickname later.
 */
async function freeUsername(
  tx: Prisma.TransactionClient,
  username: string | null,
): Promise<string | null> {
  if (!username) return null;
  const taken = await tx.bridgeProfile.findUnique({
    where: { username },
    select: { userId: true },
  });
  return taken ? null : username;
}

/** Reads the `{ S4, S5, S6 }` map the import script writes. */
function stagedEstimates(value: unknown): StagedEstimate[] {
  if (!isRecord(value)) return [];
  const result: StagedEstimate[] = [];

  for (const level of LEVELS) {
    const raw = value[level];
    if (!isRecord(raw)) continue;

    const rating = raw["usefulnessRating"];
    result.push({
      level,
      combinationCode:
        typeof raw["combinationCode"] === "string" ? raw["combinationCode"] : "",
      marks: stringMap(raw["marks"]),
      targets: targetMap(raw["targets"]),
      goalTargets: stringMap(raw["goalTargets"]),
      overallTarget:
        typeof raw["overallTarget"] === "string" ? raw["overallTarget"] : null,
      usefulnessRating:
        typeof rating === "number" &&
        Number.isInteger(rating) &&
        rating >= 1 &&
        rating <= 5
          ? rating
          : null,
    });
  }

  return result;
}

export async function claimLegacyBridgeData(user: {
  id: string;
  email: string;
  displayName?: string | null;
}): Promise<BridgeLevel | null> {
  const email = user.email.trim().toLowerCase();
  if (!email) return null;

  let staged = await prisma.bridgeLegacyStudent.findUnique({
    where: { email },
    select: { id: true, claimedAt: true },
  });

  if (!staged) {
    // Nothing is staged for this address: pull the student's clabridge record
    // now, so someone who signs up after the original import still claims
    // their nickname and their progress.
    const pulled = await pullLegacyStudentByEmail(email);
    if (pulled === "unknown" || pulled === "disabled" || pulled === "failed") {
      return null;
    }

    staged = await prisma.bridgeLegacyStudent.findUnique({
      where: { email },
      select: { id: true, claimedAt: true },
    });
  }

  if (!staged || staged.claimedAt) return null;

  try {
    return await claimLegacyRow(user, staged.id);
  } catch (error) {
    console.error("[bridge] Could not claim legacy clabridge data", error);
    return null;
  }
}

/**
 * Attaches one staged row to one account.
 *
 * The row is looked up by id rather than by address, so an administrator can
 * move a student onto the account they actually registered with even when the
 * two addresses differ. Throws on failure: the caller decides whether a
 * missing import may be swallowed.
 */
export async function claimLegacyRow(
  user: { id: string; email: string },
  rowId: string,
): Promise<BridgeLevel | null> {
  // Neon suspends an idle branch and wakes on the first query, which can eat
  // most of Prisma's 5 s default before the transaction even starts. The
  // writes themselves are a handful of rows, so a longer ceiling is safe and
  // a slow cold start must not cost the student their imported data.
  return prisma.$transaction(
    async (tx) => {
      // Re-read inside the transaction: two parallel claims of the same row
      // must not both create a profile.
      const row = await tx.bridgeLegacyStudent.findUnique({
        where: { id: rowId },
        select: {
          id: true,
          claimedAt: true,
          level: true,
          username: true,
          displayName: true,
          estimates: true,
        },
      });
      if (!row || row.claimedAt) return null;

      // The name the student had in the standalone app fills in an empty one
      // here. An account that already has a name keeps it: this is a gap to
      // fill, not a rename.
      if (row.displayName) {
        const account = await tx.user.findUnique({
          where: { id: user.id },
          select: { displayName: true },
        });
        if (account && !account.displayName?.trim()) {
          await tx.user.update({
            where: { id: user.id },
            data: { displayName: row.displayName },
          });
        }
      }

      const profile = await tx.bridgeProfile.findUnique({
        where: { userId: user.id },
        select: { userId: true, level: true, username: true },
      });

      // A source document without a level still keeps its estimates: they
      // are keyed by level, so whichever one the student picks in the
      // estimator is already populated. The picker handles the profile, and
      // the row stays unclaimed so a later visit can attach the nickname.
      if (!profile && row.level) {
        await tx.bridgeProfile.create({
          data: {
            userId: user.id,
            level: row.level,
            username: await freeUsername(tx, row.username),
          },
        });
      } else if (profile && !profile.username && row.username) {
        // A profile created before the import ran (or by a failed claim) can
        // still pick up the clabridge handle, as long as it is free.
        const username = await freeUsername(tx, row.username);
        if (username) {
          await tx.bridgeProfile.update({
            where: { userId: user.id },
            data: { username },
          });
        }
      }

      for (const estimate of stagedEstimates(row.estimates)) {
        await tx.bridgeEstimate.upsert({
          where: { userId_level: { userId: user.id, level: estimate.level } },
          create: { userId: user.id, ...estimate },
          // Anything already saved here wins; the import only fills gaps.
          update: {},
        });
      }

      // With no level and no profile there is nothing to hang the nickname
      // on yet: leave the row open so the visit after the level picker can
      // finish the claim.
      if (row.level || profile) {
        await tx.bridgeLegacyStudent.update({
          where: { id: row.id },
          data: { claimedByUserId: user.id, claimedAt: new Date() },
        });
      }

      // The level the student will actually use: their own choice wins over
      // the one clabridge had saved.
      return profile?.level ?? row.level;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
