import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCohortManager } from "@/lib/sdms/access";
import { prisma } from "@/lib/prisma";
import { getAdminAuth } from "@/lib/firebase/admin";
import { studentAuthEmail, defaultCohortPassword } from "@/lib/sdms/import-normalization";

const reImportSchema = z.object({
  importId: z.string().min(1),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cohortId } = await params;
  const actor = await requireCohortManager(cohortId);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = reImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { importId } = parsed.data;

  const originalImport = await prisma.cohortImport.findUnique({
    where: { id: importId, cohortId },
    select: {
      fileName: true,
      fileHash: true,
      cohortId: true,
      schoolId: true,
      passwordPolicy: true,
      warnings: true,
    },
  });

  if (!originalImport) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  // Re-parse the original file (would need to store file or re-upload)
  // For now, return an error indicating re-import requires re-upload
  return NextResponse.json(
    { error: "Re-import requires re-uploading the file. Please use the import preview again." },
    { status: 400 }
  );
}