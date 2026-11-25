import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCohortManager } from "@/lib/sdms/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  await requireCohortManager(cohortId);

  const imports = await prisma.cohortImport.findMany({
    where: { cohortId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      fileHash: true,
      importedById: true,
      rows: true,
      created: true,
      updated: true,
      skipped: true,
      warnings: true,
      passwordPolicy: true,
      createdAt: true,
      importer: {
        select: {
          displayName: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(imports);
}