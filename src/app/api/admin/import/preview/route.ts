import { randomBytes, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUser } from "@/lib/auth/guards";
import { prisma } from "@/lib/prisma";
import { parseWorkbook } from "@/lib/sdms/workbook-parser";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const PREVIEW_TTL_MINUTES = 30;

function hashToken(token: string): string {
  return createHmac("sha256", process.env.SDMS_SECRET ?? "dev-secret").update(token).digest("hex");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

const importPreviewSchema = z.object({
  file: z.instanceof(File).refine((f) => f.size <= MAX_FILE_SIZE, "File too large"),
  overridePassword: z.string().optional(),
});

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await requireUser();
  const formData = await request.formData();

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  const overridePassword = formData.get("overridePassword")?.toString() ?? undefined;

  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await parseWorkbook(buffer, file.name, { importYear: new Date().getFullYear() });

  if (parsed.errors.length > 0) {
    return NextResponse.json(
      { errors: parsed.errors, warnings: parsed.warnings, sheets: parsed.sheets.map(s => ({ label: s.label, rows: s.students.length })) },
      { status: 400 },
    );
  }

  // Determine password policy per cohort
  const cohortPasswordPolicies = parsed.sheets.map((sheet) => ({
    label: sheet.label,
    passwordPolicy: overridePassword ? "CUSTOM" : "DEFAULT",
    passwordSeedYear: sheet.academicYear.startYear,
  }));

  const token = generateToken();
  const commitKey = generateToken();
  const expiresAt = new Date(Date.now() + PREVIEW_TTL_MINUTES * 60 * 1000);

  await prisma.importPreview.create({
    data: {
      schoolId: "temp", // will be resolved at commit
      createdById: user.id,
      tokenHash: hashToken(token),
      commitKey: hashToken(commitKey),
      fileName: file.name,
      fileHash: createHmac("sha256", "file-hash").update(buffer).digest("hex"),
      payload: {
        sheets: parsed.sheets,
        warnings: parsed.warnings,
        totalRows: parsed.totalRows,
        overridePassword: overridePassword ?? null,
        cohortPasswordPolicies,
      },
      expiresAt,
    },
  });

  return NextResponse.json({ token, commitKey, expiresAt: expiresAt.toISOString(), preview: { sheets: parsed.sheets.map(s => ({ label: s.label, rows: s.students.length, grade: s.grade, combination: s.combination })), warnings: parsed.warnings, totalRows: parsed.totalRows } });
}