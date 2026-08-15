"use client";

import { useActionState, useEffect, useState } from "react";
import {
  addCommentAction,
  getComments,
  type ActionState,
} from "@/lib/actions/stream-actions";
import { Avatar } from "./avatar";
import { formatDateTime } from "@/lib/utils";

type Comment = {
  id: number;
  content: string;
  createdAt: Date;
  authorName: string;
  authorColor: string;
  authorId: number;
};

type Props = {
  announcementId?: number;
  assignmentId?: number;
  submissionId?: number;
  courseId: number;
};

export function CommentSection({
  announcementId,
  assignmentId,
  submissionId,
  courseId,
}: Props) {
  const [commentsList, setCommentsList] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);

  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    addCommentAction,
    {}
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await getComments(announcementId, assignmentId, submissionId);
      setCommentsList(data);
      setLoading(false);
    }
    load();
  }, [announcementId, assignmentId, submissionId, state]);

  return (
    <div className="px-4 pb-4 space-y-3">
      {loading ? (
        <p className="text-xs text-gray-400 text-center py-2">Loading...</p>
      ) : (
        commentsList.map((c) => (
          <div key={c.id} className="flex gap-2">
            <Avatar name={c.authorName} color={c.authorColor} size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-gray-800">
                  {c.authorName}
                </span>
                <span className="text-xs text-gray-400">
                  {formatDateTime(c.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-600">{c.content}</p>
            </div>
          </div>
        ))
      )}

      <form action={formAction} className="flex gap-2 pt-2">
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
        <input
          name="content"
          required
          placeholder="Add class comment..."
          className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={isPending}
          className="p-2 text-blue-600 hover:bg-blue-50 rounded-full disabled:opacity-50 cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
    </div>
  );
}
