import { NextResponse } from "next/server";

import { AuthError, requireUser } from "@/lib/auth/guards";
import { bridgeSaveRequestSchema } from "@/lib/bridge/validation";
import { prisma } from "@/lib/prisma";

/**
 * Autosave endpoint for the native CLA Bridge estimator.
 *
 * A route handler rather than a server action because the estimator flushes on
 * `pagehide` with `keepalive`, which a server action cannot do. The handler
 * applies the same level rules as the page: students may only write their own
 * saved level, while admins may inspect any level.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bridgeSaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { level, patch } = parsed.data;

  try {
    const user = await requireUser();
    if (user.role === "TEACHER") {
      return NextResponse.json(
        { error: "CLA Bridge is for students" },
        { status: 403 },
      );
    }

    const profile = await prisma.bridgeProfile.findUnique({
      where: { userId: user.id },
      select: { level: true },
    });

    if (user.role !== "ADMIN" && (!profile || profile.level !== level)) {
      return NextResponse.json(
        { error: "Choose your school level first" },
        { status: 403 },
      );
    }

    await prisma.bridgeEstimate.upsert({
      where: { userId_level: { userId: user.id, level } },
      create: { userId: user.id, level, ...patch },
      update: patch,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error("[bridge] Save failed", error);
    return NextResponse.json(
      { error: "Could not save your estimate" },
      { status: 500 },
    );
  }
}
