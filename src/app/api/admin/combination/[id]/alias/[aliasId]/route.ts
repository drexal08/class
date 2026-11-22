import { NextResponse } from "next/server";

import { requireSchoolAdmin } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; aliasId: string }> }
) {
  const { id, aliasId } = await params;
  const alias = await prisma.combinationAlias.findUnique({
    where: { id: aliasId },
    select: { id: true, combinationId: true, combination: { select: { schoolId: true } } },
  });
  if (!alias || alias.combinationId !== id) {
    return NextResponse.json({ error: "Alias not found" }, { status: 404 });
  }

  await requireSchoolAdmin(alias.combination.schoolId);

  await prisma.combinationAlias.delete({ where: { id: aliasId } });

  return NextResponse.json({ ok: true });
}