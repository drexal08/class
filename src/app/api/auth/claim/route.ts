import { NextResponse } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

const claimSchema = z.object({
  memberId: z.string().min(1),
  action: z.enum(["confirm", "dispute"]),
  note: z.string().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = claimSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { memberId, action, note } = parsed.data;

  const member = await prisma.cohortMember.findUnique({
    where: { id: memberId },
    select: { id: true, userId: true, claimedAt: true, cohortId: true, cohort: { select: { schoolId: true } } },
  });
  if (!member || member.userId !== user.id) {
    return NextResponse.json({ error: "Claim not found" }, { status: 404 });
  }
  if (member.claimedAt) {
    return NextResponse.json({ error: "Already claimed" }, { status: 409 });
  }

  if (action === "confirm") {
    await prisma.$transaction([
      prisma.cohortMember.update({
        where: { id: memberId },
        data: { claimedAt: new Date(), claimedIpHash: "pending-hash" },
      }),
      prisma.auditEvent.create({
        data: {
          schoolId: member.cohort.schoolId,
          actorId: user.id,
          action: "STUDENT_CLAIMED",
          targetType: "CohortMember",
          targetId: memberId,
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  if (action === "dispute") {
    await prisma.$transaction([
      prisma.claimDispute.create({
        data: {
          memberId,
          code: user.studentCode ?? "unknown",
          note: note ?? null,
          ipHash: "pending-hash",
        },
      }),
      prisma.auditEvent.create({
        data: {
          schoolId: member.cohort.schoolId,
          actorId: user.id,
          action: "STUDENT_DISPUTED",
          targetType: "CohortMember",
          targetId: memberId,
          metadata: { note: note ?? null },
        },
      }),
    ]);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}