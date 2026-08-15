import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, PencilLine, SquareCheckBig } from "lucide-react";

import { AttachmentList } from "@/components/shared/attachment-list";
import { CommentThread } from "@/components/stream/comment-thread";
import { SubmitWorkPanel } from "@/components/submission/submit-work-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getCurrentUser } from "@/lib/auth/session";
import { getAssignment, getOwnSubmission } from "@/lib/data/classwork";
import { getCourseForUser } from "@/lib/data/courses";
import { listAssignmentComments } from "@/lib/data/stream";
import { listSubmissionsForGrading } from "@/lib/data/grading";
import { isStorageConfigured } from "@/lib/env";
import { ASSIGNMENT_LABELS } from "@/lib/types";
import { formatDueDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}): Promise<Metadata> {
  const { id, assignmentId } = await params;
  const assignment = await getAssignment(id, assignmentId);

  return {
    title: assignment?.title ?? "Classwork",
    robots: { index: false, follow: false },
  };
}

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id, assignmentId } = await params;

  const [user, course, assignment] = await Promise.all([
    getCurrentUser(),
    getCourseForUser(id),
    getAssignment(id, assignmentId),
  ]);

  if (!user || !course || !assignment) notFound();

  const isTeacher = course.isTeacher;
  const [comments, submission, grading] = await Promise.all([
    listAssignmentComments(id, assignmentId),
    isTeacher ? Promise.resolve(null) : getOwnSubmission(id, assignmentId),
    isTeacher ? listSubmissionsForGrading(id, assignmentId) : Promise.resolve(null),
  ]);

  const gradeable = assignment.type !== "MATERIAL";

  return (
    <div className="container-page py-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4">
        <Link href={`/course/${id}/classwork`}>
          <ChevronLeft />
          Classwork
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Card className="p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{ASSIGNMENT_LABELS[assignment.type]}</Badge>
              {!assignment.published && <Badge variant="warning">Draft</Badge>}
            </div>

            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              {assignment.title}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              {gradeable && `${assignment.maxPoints} points · `}
              {formatDueDate(assignment.dueDate)}
              {assignment.topic && ` · ${assignment.topic.name}`}
            </p>

            {assignment.description && (
              <>
                <Separator className="my-5" />
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {assignment.description}
                </p>
              </>
            )}

            {assignment.attachments.length > 0 && (
              <div className="mt-5">
                <AttachmentList attachments={assignment.attachments} />
              </div>
            )}

            {assignment.rubric.length > 0 && (
              <div className="mt-6">
                <h2 className="text-sm font-medium">Rubric</h2>
                <ul className="mt-2 divide-y divide-border rounded-md border border-border">
                  {assignment.rubric.map((criterion) => (
                    <li
                      key={criterion.id}
                      className="flex items-start justify-between gap-4 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{criterion.title}</p>
                        {criterion.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {criterion.description}
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                        {criterion.points} pts
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-sm font-medium">Class comments</h2>
            <CommentThread
              comments={comments}
              courseId={id}
              assignmentId={assignmentId}
              viewerId={user.id}
              canModerate={isTeacher}
              canComment={!course.archived}
              emptyLabel="No class comments yet."
            />
          </Card>
        </div>

        <aside className="space-y-4">
          {isTeacher ? (
            <Card className="p-5">
              <h2 className="font-medium">Student work</h2>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Stat
                  value={grading?.counts.turnedIn ?? 0}
                  label="Turned in"
                />
                <Stat value={grading?.counts.graded ?? 0} label="Graded" />
              </div>

              {gradeable && (
                <Button asChild className="mt-5 w-full">
                  <Link href={`/course/${id}/classwork/${assignmentId}/grade`}>
                    <SquareCheckBig />
                    Review and grade
                  </Link>
                </Button>
              )}

              <Button asChild variant="outline" className="mt-2 w-full">
                <Link href={`/course/${id}/classwork/${assignmentId}/edit`}>
                  <PencilLine />
                  Edit
                </Link>
              </Button>
            </Card>
          ) : gradeable ? (
            <SubmitWorkPanel
              courseId={id}
              assignmentId={assignmentId}
              maxPoints={assignment.maxPoints}
              submission={submission}
              uploadsEnabled={isStorageConfigured()}
              locked={course.archived}
            />
          ) : (
            <Card className="p-5">
              <h2 className="font-medium">Material</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                There is nothing to turn in for this item — it is here for you to
                read and refer back to.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
