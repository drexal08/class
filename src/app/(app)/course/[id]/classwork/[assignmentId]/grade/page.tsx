import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { GradingWorkspace } from "@/components/grading/grading-workspace";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/session";
import { listSubmissionsForGrading } from "@/lib/data/grading";

export const metadata: Metadata = {
  title: "Grade",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function GradePage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;

  const user = await getCurrentUser();
  if (!user) notFound();

  // Teacher-only; the guard inside throws for anyone else.
  const data = await listSubmissionsForGrading(id, assignmentId).catch(() => null);
  if (!data) notFound();

  return (
    <div className="container-page py-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={`/course/${id}/classwork/${assignmentId}`}>
              <ChevronLeft />
              Back to assignment
            </Link>
          </Button>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {data.assignment.title}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.counts.turnedIn} of {data.counts.total} turned in ·{" "}
            {data.counts.graded} graded
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Press <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">j</kbd>{" "}
          and{" "}
          <kbd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono">k</kbd>{" "}
          to move between students
        </p>
      </div>

      <GradingWorkspace
        courseId={id}
        assignmentId={assignmentId}
        assignmentTitle={data.assignment.title}
        maxPoints={data.assignment.maxPoints}
        rubric={data.assignment.rubric}
        rows={data.rows}
        viewerId={user.id}
      />
    </div>
  );
}
