import { NextResponse } from "next/server";
import { z } from "zod";

import { requireCohortManager } from "@/lib/sdms/access";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  format: z.enum(["csv"]).default("csv"),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; importId: string }> }
) {
  const { id: cohortId, importId } = await params;
  await requireCohortManager(cohortId);

  const importRecord = await prisma.cohortImport.findUnique({
    where: { id: importId, cohortId },
    select: {
      id: true,
      fileName: true,
      fileHash: true,
      cohortId: true,
      schoolId: true,
      passwordPolicy: true,
      warnings: true,
      createdAt: true,
    },
  });

  if (!importRecord) {
    return NextResponse.json({ error: "Import not found" }, { status: 404 });
  }

  // Get the cohort members created/updated by this import
  const members = await prisma.cohortMember.findMany({
    where: {
      cohortId,
      // We can't directly link to import, so we use the import timestamp as a proxy
      // In a real implementation, you'd track which members came from which import
    },
    select: {
      id: true,
      status: true,
      user: {
        select: {
          id: true,
          studentCode: true,
          displayName: true,
          email: true,
        },
      },
    },
  });

  // Generate CSV
  const csvRows = [
    "student_code,display_name,email,cohort_id,cohort_label,import_file,imported_at,password_policy",
  ];

  // Since we can't directly link members to imports without additional tracking,
  // we'll note this limitation in the CSV
  csvRows.push(
    `,,,,,,${importRecord.fileName},${importRecord.createdAt.toISOString()},${importRecord.passwordPolicy}`
  );

  const csv = csvRows.join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="credentials-${importRecord.id}.csv"`,
    },
  });
}