import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ReportCard } from "@/components/school/report-card";
import { getStudentReportCard } from "@/lib/data/school";

export const metadata: Metadata = { title: "Report card" };
export const dynamic = "force-dynamic";

export default async function ReportCardPage({
  params,
}: {
  params: Promise<{ termId: string }>;
}) {
  const { termId } = await params;
  const data = await getStudentReportCard(termId);
  if (!data) notFound();

  return (
    <div className="container-feed py-8 print:py-0">
      <ReportCard data={data} />
    </div>
  );
}
