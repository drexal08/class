"use client";

import { useActionState, useState } from "react";
import { UserPlus } from "lucide-react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinCourseAction } from "@/lib/actions/course-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function JoinCourseDialog({ trigger }: { trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    joinCourseAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <UserPlus />
            Join class
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Join a class</DialogTitle>
          <DialogDescription>
            Ask your teacher for the seven-character class code.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <FormError message={state.error} />

          <div className="space-y-2">
            <Label htmlFor="code">Class code</Label>
            <Input
              id="code"
              name="code"
              required
              maxLength={7}
              minLength={7}
              autoFocus
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC1234"
              className="text-center font-mono text-lg tracking-[0.3em] uppercase"
            />
            <p className="text-xs text-muted-foreground">
              Seven letters and numbers, no spaces.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Joining…" : "Join"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
