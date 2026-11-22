import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth/session";
import { getPendingClaim } from "@/lib/auth/claim";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const pending = await getPendingClaim(user.id);
  if (!pending) return NextResponse.json({ error: "No pending claim" }, { status: 404 });

  return NextResponse.json(pending);
}