import { NextResponse } from "next/server";

import {
  isDatabaseConfigured,
  isFirebaseAdminConfigured,
  isRealtimeConfigured,
  isStorageConfigured,
} from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Liveness plus a summary of which optional integrations are wired up. */
export async function GET() {
  const services = {
    database: isDatabaseConfigured(),
    auth: isFirebaseAdminConfigured(),
    storage: isStorageConfigured(),
    realtime: isRealtimeConfigured(),
  };

  if (!services.database) {
    return NextResponse.json(
      { ok: false, reason: "DATABASE_URL is not configured", services },
      { status: 503 },
    );
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, services });
  } catch (error) {
    console.error("[health] Database unreachable", error);
    return NextResponse.json(
      { ok: false, reason: "Database unreachable", services },
      { status: 503 },
    );
  }
}
