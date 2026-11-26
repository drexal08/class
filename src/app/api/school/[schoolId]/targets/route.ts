import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getTeacherSchoolTargets } from "@/lib/data/school";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ schoolId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { schoolId } = await params;
  const targets = await getTeacherSchoolTargets(schoolId);

  if (!targets) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(targets);
}