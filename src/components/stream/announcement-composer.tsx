"use client";

import { useActionState, useRef, useState } from "react";

import { FormError } from "@/components/shared/form-error";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncementAction } from "@/lib/actions/stream-actions";
import { EMPTY_ACTION_STATE, type ActionState, type SessionUser } from "@/lib/types";

export function AnnouncementComposer({
  courseId,
  user,
}: {
  courseId: string;
  user: SessionUser;
}) {
  const [expanded, setExpanded] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Collapsing happens inside the action rather than in an effect watching the
  // result — an effect that calls setState would cascade an extra render.
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await createAnnouncementAction(previous, formData);
      if (result.success) {
        formRef.current?.reset();
        setExpanded(false);
      }
      return result;
    },
    EMPTY_ACTION_STATE,
  );

  if (!expanded) {
    return (
      <Card className="p-3">
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary"
        >
          <UserAvatar user={user} className="size-8" />
          Share something with your class
        </button>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <form ref={formRef} action={formAction} className="space-y-3">
        <input type="hidden" name="courseId" value={courseId} />

        <FormError message={state.error} />

        <div className="flex gap-3">
          <UserAvatar user={user} className="size-8 shrink-0" />
          <Textarea
            name="content"
            required
            autoFocus
            maxLength={10000}
            rows={4}
            placeholder="Share an update, a reminder, or a question…"
            aria-label="Announcement"
            className="resize-y"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Posting…" : "Post"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
