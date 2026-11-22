import { NextResponse } from "next/server";

import { exportClaimStatusCsv } from "@/lib/data/school-admin";
import { requireSchoolAdmin } from "@/lib/sdms/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const csv = await exportClaimStatusCsv(id);
  
  if (!csv) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="claim-status-${id}.csv"`,
    },
  });
}