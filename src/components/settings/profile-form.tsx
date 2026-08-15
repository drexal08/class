"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileAction } from "@/lib/actions/auth-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function ProfileForm({ displayName }: { displayName: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateProfileAction,
    EMPTY_ACTION_STATE,
  );

  useEffect(() => {
    if (state.success) toast.success("Name updated");
  }, [state]);

  return (
    <form action={formAction} className="mt-4 space-y-3">
      <FormError message={state.error} />

      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          required
          minLength={2}
          maxLength={80}
          defaultValue={displayName}
          className="max-w-sm"
        />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
