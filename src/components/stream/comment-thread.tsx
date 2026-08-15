"use client";

import { useActionState, useEffect, useRef } from "react";
import { Send, Trash2 } from "lucide-react";

import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addCommentAction, deleteCommentAction } from "@/lib/actions/stream-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { displayNameOf, formatRelative } from "@/lib/utils";

export type ThreadComment = {
  id: string;
  content: string;
  createdAt: Date;
  authorId: string;
  author: {
    id: string;
    displayName: string | null;
    email: string | null;
    avatarUrl: string | null;
  };
};

/**
 * Comments arrive as props from the server render rather than being fetched on
 * mount — the previous version issued one request per announcement and showed
 * "Loading…" on every card.
 */
export function CommentThread({
  comments,
  courseId,
  announcementId,
  assignmentId,
  submissionId,
  viewerId,
  canModerate,
  canComment = true,
  placeholder = "Add a class comment",
  emptyLabel,
}: {
  comments: ThreadComment[];
  courseId: string;
  announcementId?: string;
  assignmentId?: string;
  submissionId?: string;
  viewerId: string;
  canModerate: boolean;
  canComment?: boolean;
  placeholder?: string;
  emptyLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addCommentAction,
    EMPTY_ACTION_STATE,
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Clear the box once the comment lands, so a fast second comment is easy.
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="space-y-3">
      {comments.length === 0 && emptyLabel && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}

      {comments.length > 0 && (
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="group flex gap-2.5">
              <UserAvatar user={comment.author} className="size-7 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium">
                    {displayNameOf(comment.author)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(comment.createdAt)}
                  </span>
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>

              {(canModerate || comment.authorId === viewerId) && (
                <form
                  action={async () => {
                    await deleteCommentAction(courseId, comment.id);
                  }}
                >
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form ref={formRef} action={formAction} className="flex items-center gap-2">
          <input type="hidden" name="courseId" value={courseId} />
          {announcementId && (
            <input type="hidden" name="announcementId" value={announcementId} />
          )}
          {assignmentId && (
            <input type="hidden" name="assignmentId" value={assignmentId} />
          )}
          {submissionId && (
            <input type="hidden" name="submissionId" value={submissionId} />
          )}

          <Input
            name="content"
            required
            maxLength={5000}
            placeholder={placeholder}
            className="h-9 rounded-full"
            aria-label={placeholder}
          />
          <Button
            type="submit"
            size="icon"
            variant="ghost"
            className="size-9 shrink-0"
            disabled={pending}
            aria-label="Post comment"
          >
            <Send className="size-4" strokeWidth={1.75} />
          </Button>
        </form>
      )}

      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
    </div>
  );
}
