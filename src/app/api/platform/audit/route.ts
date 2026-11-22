import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSuperuser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const auditSchema = z.object({
  schoolId: z.string().optional(),
  actorId: z.string().optional(),
  action: z.string().optional(),
  targetType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await requireSuperuser();

  const { searchParams } = new URL(request.url);
  const parsed = auditSchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid query" }, { status: 400 });
  }

  const { schoolId, actorId, action, targetType, from, to, limit, offset } = parsed.data;

  const where: Record<string, unknown> = {};
  if (schoolId) where.schoolId = schoolId;
  if (actorId) where.actorId = actorId;
  if (action) where.action = action;
  if (targetType) where.targetType = targetType;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as Record<string, Date>).gte = new Date(from);
    if (to) (where.createdAt as Record<string, Date>).lte = new Date(to);
  }

  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        schoolId: true,
        actorId: true,
        action: true,
        targetType: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  return NextResponse.json({ events, total, limit, offset });
}