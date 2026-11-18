"use client";

import { useActionState } from "react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveReportCommentAction } from "@/lib/actions/report-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function ReportCommentForm({
  courseId,
  termId,
  studentId,
  body,
}: {
  courseId: string;
  termId: string;
  studentId: string;
  body: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveReportCommentAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="termId" value={termId} />
      <input type="hidden" name="studentId" value={studentId} />

      <FormError message={state.error} />

      <Textarea
        name="body"
        aria-label="Report comment"
        rows={3}
        maxLength={4000}
        defaultValue={body ?? ""}
        placeholder="A short comment for this student's report card."
      />

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Saving…" : "Save comment"}
        </Button>
        {state.success && !pending && (
          <span className="text-xs text-success">Saved</span>
        )}
      </div>
    </form>
  );
}
