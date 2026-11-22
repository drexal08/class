import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireSchoolAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const combinationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  shortName: z.string().trim().max(20).optional(),
  stream: z.string().trim().max(60).optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }
  await requireSchoolAdmin(schoolId);

  const combinations = await prisma.combination.findMany({
    where: { schoolId },
    orderBy: { stream: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      stream: true,
      aliases: { select: { id: true, alias: true, normalizedAlias: true } },
    },
  });

  return NextResponse.json(combinations);
}

export async function POST(request: NextRequest) {
  const schoolId = request.nextUrl.searchParams.get("schoolId");
  if (!schoolId) {
    return NextResponse.json({ error: "schoolId is required" }, { status: 400 });
  }
  await requireSchoolAdmin(schoolId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = combinationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const combination = await prisma.combination.create({
    data: {
      schoolId,
      name: parsed.data.name,
      shortName: parsed.data.shortName ?? parsed.data.name.slice(0, 20),
      stream: parsed.data.stream ?? "",
    },
    select: { id: true, name: true, shortName: true, stream: true },
  });

  return NextResponse.json(combination, { status: 201 });
}