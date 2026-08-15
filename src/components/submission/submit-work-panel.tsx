"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, Undo2 } from "lucide-react";

import { AttachmentList, type AttachmentSummary } from "@/components/shared/attachment-list";
import { FileUploader } from "@/components/shared/file-uploader";
import { FormError } from "@/components/shared/form-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  submitWorkAction,
  unsubmitWorkAction,
} from "@/lib/actions/submission-actions";
import {
  EMPTY_ACTION_STATE,
  SUBMISSION_LABELS,
  SUBMISSION_TONES,
  type ActionState,
} from "@/lib/types";
import type { SubmissionState } from "@/generated/prisma/client";
import { cn, formatDateTime } from "@/lib/utils";

type Submission = {
  id: string;
  status: SubmissionState;
  grade: number | null;
  feedback: string | null;
  content: string | null;
  submittedAt: Date | null;
  attachments: AttachmentSummary[];
};

export function SubmitWorkPanel({
  courseId,
  assignmentId,
  maxPoints,
  submission,
  uploadsEnabled,
  locked,
}: {
  courseId: string;
  assignmentId: string;
  maxPoints: number;
  submission: Submission | null;
  uploadsEnabled: boolean;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitWorkAction,
    EMPTY_ACTION_STATE,
  );
  const [unsubmitting, startUnsubmit] = useTransition();

  const status = submission?.status ?? "ASSIGNED";
  const handedIn = status !== "ASSIGNED";
  // Once a teacher has graded or returned work, it can no longer be recalled.
  const canUnsubmit = status === "SUBMITTED" || status === "LATE";

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-medium">Your work</h2>
        <Badge variant="outline" className={cn(SUBMISSION_TONES[status])}>
          {SUBMISSION_LABELS[status]}
        </Badge>
      </div>

      {submission?.grade !== null && submission?.grade !== undefined && (
        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {submission.grade}
          <span className="text-base font-normal text-muted-foreground">
            /{maxPoints}
          </span>
        </p>
      )}

      {submission?.submittedAt && (
        <p className="mt-1 text-xs text-muted-foreground">
          Turned in {formatDateTime(submission.submittedAt)}
        </p>
      )}

      {handedIn ? (
        <div className="mt-4 space-y-4">
          {submission?.content && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground">
                Your response
              </h3>
              <p className="mt-1.5 rounded-md bg-secondary p-3 text-sm whitespace-pre-wrap">
                {submission.content}
              </p>
            </div>
          )}

          {submission && submission.attachments.length > 0 && (
            <div>
              <h3 className="mb-1.5 text-xs font-medium text-muted-foreground">
                Attached
              </h3>
              <AttachmentList attachments={submission.attachments} />
            </div>
          )}

          {submission?.feedback && (
            <>
              <Separator />
              <div>
                <h3 className="text-xs font-medium text-muted-foreground">
                  Teacher feedback
                </h3>
                <p className="mt-1.5 rounded-md border border-border p-3 text-sm whitespace-pre-wrap">
                  {submission.feedback}
                </p>
              </div>
            </>
          )}

          {canUnsubmit && !locked && (
            <Button
              variant="outline"
              className="w-full"
              disabled={unsubmitting}
              onClick={() =>
                startUnsubmit(async () => {
                  await unsubmitWorkAction(courseId, assignmentId);
                })
              }
            >
              <Undo2 />
              {unsubmitting ? "Unsubmitting…" : "Unsubmit"}
            </Button>
          )}

          {!canUnsubmit && (
            <p className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Your teacher has marked this work, so it can no longer be
              unsubmitted.
            </p>
          )}
        </div>
      ) : locked ? (
        <p className="mt-4 text-sm text-muted-foreground">
          This class is archived, so no new work can be turned in.
        </p>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="assignmentId" value={assignmentId} />

          <FormError message={state.error} />

          <Textarea
            name="content"
            rows={5}
            maxLength={20000}
            placeholder="Type your response, or attach a file below."
            aria-label="Your response"
          />

          {submission && (
            <FileUploader
              courseId={courseId}
              scope="submission"
              targetId={submission.id}
              enabled={uploadsEnabled}
            />
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Turning in…" : "Turn in"}
          </Button>

          {!submission && (
            <p className="text-xs text-muted-foreground">
              Turn in once to attach files to this assignment.
            </p>
          )}
        </form>
      )}
    </Card>
  );
}
