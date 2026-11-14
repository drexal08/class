import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { pullAllLegacyStudents } from "@/lib/bridge/legacy-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** A full sweep reads a few hundred Firestore documents. */
export const maxDuration = 60;

/**
 * Pulls the clabridge students that are not staged yet.
 *
 * The import is automatic for a student who opens the estimator: their
 * clabridge record is pulled on the spot. This endpoint does the same thing
 * for everybody at once, so an administrator can see who is waiting without
 * waiting for a sign-in, and so a scheduled job can keep the list fresh.
 *
 * Two ways in:
 *
 * - an administrator's session cookie;
 * - `Authorization: Bearer $CRON_SECRET`, which is what Vercel's cron sends.
 */
export async function POST(request: Request) {
  const authorized = await isAuthorized(request);
  if (!authorized) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  try {
    const summary = await pullAllLegacyStudents();
    if (summary.disabled) {
      return NextResponse.json(
        {
          error:
            "This deployment has no credentials for the standalone CLA Bridge project.",
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[bridge] The clabridge sync failed", error);
    return NextResponse.json(
      { error: "Could not pull the clabridge imports" },
      { status: 500 },
    );
  }
}

/** An administrator's session, or the shared secret a scheduler holds. */
async function isAuthorized(request: Request): Promise<boolean> {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const header = request.headers.get("authorization");
    if (header === `Bearer ${secret}`) return true;
  }

  const user = await getCurrentUser();
  return Boolean(user?.isAdmin);
}
