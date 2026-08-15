"use client";

import { useActionState } from "react";
import Link from "next/link";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { joinCourseAction } from "@/lib/actions/course-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

/**
 * Joining is a POST behind an explicit confirmation rather than a side effect
 * of loading the link — a GET should never change the roster.
 */
export function JoinConfirm({ code }: { code: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    joinCourseAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="code" value={code} />

      <FormError message={state.error} />

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Joining…" : "Join class"}
        </Button>
        <Button asChild variant="ghost" type="button">
          <Link href="/dashboard">Not now</Link>
        </Button>
      </div>
    </form>
  );
}
