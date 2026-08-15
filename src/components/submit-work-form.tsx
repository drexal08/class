"use client";

import { useActionState } from "react";
import {
  submitWorkAction,
  type ActionState,
} from "@/lib/actions/assignment-actions";

type Props = {
  assignmentId: number;
  courseId: number;
};

export function SubmitWorkForm({ assignmentId }: Props) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    submitWorkAction,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <textarea
        name="content"
        rows={4}
        placeholder="Add your work here..."
        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
      />
      {state.error && (
        <p className="text-xs text-red-600">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
      >
        {isPending ? "Submitting..." : "Turn in"}
      </button>
    </form>
  );
}
