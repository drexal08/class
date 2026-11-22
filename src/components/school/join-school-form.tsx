"use client";

import { useActionState } from "react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinSchoolAction } from "@/lib/actions/school-admin-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function JoinSchoolForm() {
  const [state, action, pending] = useActionState<ActionState, FormData>(
    joinSchoolAction,
    EMPTY_ACTION_STATE,
  );
  return (
    <form action={action} className="max-w-md space-y-4">
      <div className="space-y-2">
        <Label htmlFor="school-code">School code</Label>
        <Input
          id="school-code"
          name="code"
          required
          autoCapitalize="characters"
          autoComplete="off"
          placeholder="SCH-XXXXXXXX"
          className="font-mono uppercase"
        />
      </div>
      <FormError message={state.error} />
      {state.success && (
        <p role="status" className="text-sm text-success">
          Request sent. A school admin must approve it before you can open the school console.
        </p>
      )}
      <Button disabled={pending}>{pending ? "Sending…" : "Request to join"}</Button>
    </form>
  );
}
