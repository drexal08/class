import type { Metadata } from "next";

import { BridgeEstimator } from "@/components/bridge/bridge-estimator";
import { BridgeLevelPicker } from "@/components/bridge/level-picker";
import { Card } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth/session";
import { claimLegacyBridgeData } from "@/lib/bridge/claim";
import { fromBridgeLevel } from "@/lib/bridge/combinations";
import { bridgeLevelSchema } from "@/lib/bridge/validation";
import type { SubjectTargets } from "@/lib/bridge/target-table";
import { getBridgeWorkspace } from "@/lib/data/bridge";

export const metadata: Metadata = { title: "CLA Bridge" };
export const dynamic = "force-dynamic";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Coerce a stored JSON map of marks or goals into string values. */
function stringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "string") result[key] = raw;
    else if (typeof raw === "number" && Number.isFinite(raw)) {
      result[key] = String(raw);
    }
  }
  return result;
}

/**
 * Rebuild the per-subject assessment tables from JSON.
 *
 * The columns are validated leniently: a malformed cell becomes an empty one
 * rather than breaking the whole page, because a saved estimate should never
 * make the estimator unreachable.
 */
function targetsRecord(value: unknown): Record<string, SubjectTargets> {
  if (!isRecord(value)) return {};
  const result: Record<string, SubjectTargets> = {};
  for (const [name, table] of Object.entries(value)) {
    if (!isRecord(table)) continue;
    const next: SubjectTargets = {};
    for (const [column, cells] of Object.entries(table)) {
      if (!Array.isArray(cells)) continue;
      next[column] = cells.map((cell) => ({
        got: isRecord(cell) && typeof cell["got"] === "string" ? cell["got"] : "",
        total:
          isRecord(cell) && typeof cell["total"] === "string"
            ? cell["total"]
            : "",
      }));
    }
    result[name] = next;
  }
  return result;
}

export default async function BridgePage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level: requestedLevel } = await searchParams;
  const requested = bridgeLevelSchema.safeParse(
    String(requestedLevel ?? "").toUpperCase(),
  );

  // Claiming is a write, but it has to happen before the workspace is read so
  // a returning clabridge student lands on their saved estimate instead of the
  // level picker. It is idempotent, so a prefetch or a double render is safe.
  const signedIn = await getCurrentUser();
  if (signedIn && signedIn.role !== "TEACHER") {
    await claimLegacyBridgeData(signedIn);
  }

  const workspace = await getBridgeWorkspace(
    requested.success ? requested.data : undefined,
  );

  if (!workspace.allowed) {
    return (
      <div className="container-page py-8">
        <Card className="mx-auto max-w-xl p-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            CLA Bridge is for students
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            The report estimator is a student tool. Teachers can keep using the
            gradebook and classwork views for their classes.
          </p>
        </Card>
      </div>
    );
  }

  const { user, level, estimate } = workspace;

  if (!level) {
    return (
      <div className="container-page py-10">
        <BridgeLevelPicker isAdmin={user.isAdmin} />
      </div>
    );
  }

  const ownerName =
    user.displayName?.trim() || user.email.split("@")[0] || "there";

  return (
    <BridgeEstimator
      key={level}
      level={fromBridgeLevel(level)}
      ownerName={ownerName}
      email={user.email}
      username={workspace.profile?.username ?? null}
      isAdmin={user.isAdmin}
      initial={{
        combinationCode: estimate?.combinationCode ?? "",
        marks: stringRecord(estimate?.marks),
        targets: targetsRecord(estimate?.targets),
        goalTargets: stringRecord(estimate?.goalTargets),
        overallTarget: estimate?.overallTarget ?? "",
        usefulnessRating: estimate?.usefulnessRating ?? null,
      }}
    />
  );
}
