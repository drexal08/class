"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { AttachmentList, type AttachmentSummary } from "@/components/shared/attachment-list";
import { FormError } from "@/components/shared/form-error";
import { UserAvatar } from "@/components/shared/user-avatar";
import {
  CommentThread,
  type ThreadComment,
} from "@/components/stream/comment-thread";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  gradeSubmissionAction,
  returnAllAction,
  returnSubmissionAction,
} from "@/lib/actions/submission-actions";
import type { SubmissionState } from "@/generated/prisma/client";
import {
  EMPTY_ACTION_STATE,
  SUBMISSION_LABELS,
  SUBMISSION_TONES,
  type ActionState,
} from "@/lib/types";
import { cn, displayNameOf, formatDateTime } from "@/lib/utils";

type Criterion = {
  id: string;
  title: string;
  description: string | null;
  points: number;
};

type Row = {
  student: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
  status: SubmissionState;
  submission: {
    id: string;
    grade: number | null;
    feedback: string | null;
    content: string | null;
    submittedAt: Date | null;
    attachments: AttachmentSummary[];
    rubricScores: { criterionId: string; points: number }[];
    comments: ThreadComment[];
  } | null;
};

/**
 * Split-screen marking (PRD Module D).
 *
 * Left: the roster and the student's actual work. Right: grade, rubric and
 * private feedback. Keeping both on screen is the whole point — the teacher
 * never loses sight of the work while entering a mark.
 */
export function GradingWorkspace({
  courseId,
  assignmentId,
  assignmentTitle,
  maxPoints,
  rubric,
  rows,
  viewerId,
}: {
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  maxPoints: number;
  rubric: Criterion[];
  rows: Row[];
  viewerId: string;
}) {
  const [selectedId, setSelectedId] = useState(rows[0]?.student.id ?? null);
  const [returning, startReturn] = useTransition();

  const selected = useMemo(
    () => rows.find((row) => row.student.id === selectedId) ?? rows[0] ?? null,
    [rows, selectedId],
  );

  // j/k move between students without leaving the keyboard, the way a marker
  // working through a stack actually wants to move.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      if (event.key !== "j" && event.key !== "k") return;

      const index = rows.findIndex((row) => row.student.id === selected?.student.id);
      if (index === -1) return;

      const nextIndex =
        event.key === "j"
          ? Math.min(index + 1, rows.length - 1)
          : Math.max(index - 1, 0);
      setSelectedId(rows[nextIndex].student.id);
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, selected]);

  const gradedCount = rows.filter((row) =>
    ["GRADED", "RETURNED"].includes(row.status),
  ).length;
  const readyToReturn = rows.some((row) => row.status === "GRADED");

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)_22rem]">
      {/* Roster rail */}
      <Card className="h-fit overflow-hidden lg:sticky lg:top-20">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Students</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {gradedCount}/{rows.length}
          </span>
        </div>

        <ul className="max-h-[70vh] overflow-y-auto">
          {rows.map((row) => {
            const active = row.student.id === selected?.student.id;
            return (
              <li key={row.student.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(row.student.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-l-2 px-4 py-2.5 text-left transition-colors",
                    active
                      ? "border-foreground bg-secondary"
                      : "border-transparent hover:bg-secondary/50",
                  )}
                >
                  <UserAvatar user={row.student} className="size-7 shrink-0" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">
                      {displayNameOf(row.student)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {SUBMISSION_LABELS[row.status]}
                    </span>
                  </span>
                  {row.submission?.grade !== null &&
                    row.submission?.grade !== undefined && (
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {row.submission.grade}
                      </span>
                    )}
                </button>
              </li>
            );
          })}
        </ul>

        {readyToReturn && (
          <div className="border-t border-border p-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              disabled={returning}
              onClick={() =>
                startReturn(async () => {
                  const result = await returnAllAction(courseId, assignmentId);
                  if (result.error) toast.error(result.error);
                  else toast.success("Graded work returned to students");
                })
              }
            >
              <Send strokeWidth={1.75} />
              Return all graded
            </Button>
          </div>
        )}
      </Card>

      {/* The student's work */}
      <Card className="min-w-0 p-6">
        {!selected ? (
          <p className="text-sm text-muted-foreground">
            No students are enrolled in this class yet.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <UserAvatar user={selected.student} />
                <div>
                  <p className="font-medium">
                    {displayNameOf(selected.student)}
                  </p>
                  {selected.submission?.submittedAt && (
                    <p className="text-xs text-muted-foreground">
                      Turned in {formatDateTime(selected.submission.submittedAt)}
                    </p>
                  )}
                </div>
              </div>

              <Badge
                variant="outline"
                className={cn(SUBMISSION_TONES[selected.status])}
              >
                {SUBMISSION_LABELS[selected.status]}
              </Badge>
            </div>

            <Separator className="my-5" />

            <h2 className="sr-only">Submitted work for {assignmentTitle}</h2>

            {selected.submission?.content ? (
              <div className="rounded-md bg-secondary p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {selected.submission.content}
              </div>
            ) : null}

            {selected.submission && selected.submission.attachments.length > 0 && (
              <div className="mt-4">
                <AttachmentList attachments={selected.submission.attachments} />
              </div>
            )}

            {!selected.submission?.content &&
              !selected.submission?.attachments.length && (
                <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-16 text-center">
                  <FileText
                    className="size-5 text-muted-foreground"
                    strokeWidth={1.75}
                    aria-hidden
                  />
                  <p className="mt-3 text-sm font-medium">Nothing turned in</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    You can still record a grade and leave feedback.
                  </p>
                </div>
              )}
          </>
        )}
      </Card>

      {/* Grade, rubric, private feedback */}
      <div className="space-y-4 lg:sticky lg:top-20 lg:h-fit">
        {selected && (
          <GradePanel
            key={selected.student.id}
            courseId={courseId}
            row={selected}
            maxPoints={maxPoints}
            rubric={rubric}
            viewerId={viewerId}
          />
        )}
      </div>
    </div>
  );
}

function GradePanel({
  courseId,
  row,
  maxPoints,
  rubric,
  viewerId,
}: {
  courseId: string;
  row: Row;
  maxPoints: number;
  rubric: Criterion[];
  viewerId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    gradeSubmissionAction,
    EMPTY_ACTION_STATE,
  );
  const [returning, startReturn] = useTransition();

  const scores = useMemo(() => {
    const map = new Map<string, number>();
    row.submission?.rubricScores.forEach((score) =>
      map.set(score.criterionId, score.points),
    );
    return map;
  }, [row.submission]);

  useEffect(() => {
    if (state.success) toast.success("Grade saved");
  }, [state]);

  if (!row.submission) {
    return (
      <Card className="p-5">
        <h2 className="font-medium">Grade</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This student has not opened the assignment yet, so there is nothing to
          grade. A grade can be recorded once they turn something in.
        </p>
      </Card>
    );
  }

  const submissionId = row.submission.id;

  return (
    <>
      <Card className="p-5">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="submissionId" value={submissionId} />

          <FormError message={state.error} />

          <div className="space-y-2">
            <Label htmlFor="grade">Grade</Label>
            <div className="flex items-center gap-2">
              <Input
                id="grade"
                name="grade"
                type="number"
                min={0}
                max={maxPoints}
                step="0.5"
                defaultValue={row.submission.grade ?? ""}
                className="w-24 text-center tabular-nums"
              />
              <span className="text-sm text-muted-foreground">
                out of {maxPoints}
              </span>
            </div>
          </div>

          {rubric.length > 0 && (
            <div className="space-y-2">
              <Label>Rubric</Label>
              <ul className="space-y-2">
                {rubric.map((criterion) => (
                  <li
                    key={criterion.id}
                    className="rounded-md border border-border p-3"
                  >
                    <input
                      type="hidden"
                      name="criterionId"
                      value={criterion.id}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{criterion.title}</p>
                        {criterion.description && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {criterion.description}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Input
                          name="criterionPoints"
                          type="number"
                          min={0}
                          max={criterion.points}
                          step="0.5"
                          defaultValue={scores.get(criterion.id) ?? ""}
                          className="h-8 w-16 text-center tabular-nums"
                          aria-label={`Points for ${criterion.title}`}
                        />
                        <span className="text-xs text-muted-foreground tabular-nums">
                          /{criterion.points}
                        </span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="feedback">Feedback</Label>
            <Textarea
              id="feedback"
              name="feedback"
              rows={4}
              maxLength={10000}
              defaultValue={row.submission.feedback ?? ""}
              placeholder="What did they do well, and what should they work on?"
            />
          </div>

          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={pending}>
              {pending ? "Saving…" : "Save grade"}
            </Button>

            {row.status === "GRADED" && (
              <Button
                type="button"
                variant="outline"
                disabled={returning}
                onClick={() =>
                  startReturn(async () => {
                    const result = await returnSubmissionAction(submissionId);
                    if (result.error) toast.error(result.error);
                    else toast.success("Returned to student");
                  })
                }
              >
                <Send strokeWidth={1.75} />
                Return
              </Button>
            )}
          </div>

          {row.status === "RETURNED" && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <Undo2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Returned — the student can see this grade and feedback.
            </p>
          )}
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-medium">Private comments</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Only this student can see these.
        </p>
        <CommentThread
          comments={row.submission.comments}
          courseId={courseId}
          submissionId={submissionId}
          viewerId={viewerId}
          canModerate
          placeholder="Add a private comment"
          emptyLabel="No private comments yet."
        />
      </Card>
    </>
  );
}
