import { NextResponse } from "next/server";
import { z } from "zod";

import { requireSchoolAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

const updateCombinationSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120).optional(),
  shortName: z.string().trim().max(20).optional(),
  stream: z.string().trim().max(60).optional(),
});

const aliasSchema = z.object({
  alias: z.string().trim().min(1, "Alias is required").max(120),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const combination = await prisma.combination.findUnique({
    where: { id },
    select: { id: true, schoolId: true },
  });
  if (!combination) return NextResponse.json({ error: "Combination not found" }, { status: 404 });

  await requireSchoolAdmin(combination.schoolId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = updateCombinationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const updated = await prisma.combination.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, shortName: true, stream: true },
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const combination = await prisma.combination.findUnique({
    where: { id },
    select: { id: true, schoolId: true },
  });
  if (!combination) return NextResponse.json({ error: "Combination not found" }, { status: 404 });

  await requireSchoolAdmin(combination.schoolId);

  await prisma.combination.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

// Alias management
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const combination = await prisma.combination.findUnique({
    where: { id },
    select: { id: true, schoolId: true },
  });
  if (!combination) return NextResponse.json({ error: "Combination not found" }, { status: 404 });

  await requireSchoolAdmin(combination.schoolId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = aliasSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const normalizedAlias = parsed.data.alias
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

  const alias = await prisma.combinationAlias.create({
    data: {
      schoolId: combination.schoolId,
      combinationId: id,
      alias: parsed.data.alias,
      normalizedAlias,
    },
    select: { id: true, alias: true, normalizedAlias: true },
  });

  return NextResponse.json(alias, { status: 201 });
}