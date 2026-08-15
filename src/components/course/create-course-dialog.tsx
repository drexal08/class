"use client";

import { useActionState, useState } from "react";
import { Plus } from "lucide-react";

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
import { createCourseAction } from "@/lib/actions/course-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function CreateCourseDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createCourseAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus />
            Create class
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a class</DialogTitle>
          <DialogDescription>
            You&rsquo;ll get a join code to share with your students.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <FormError message={state.error} />

          <div className="space-y-2">
            <Label htmlFor="name">
              Class name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              required
              maxLength={120}
              placeholder="Biology 101"
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Input id="section" name="section" placeholder="Period 3" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" name="subject" placeholder="Science" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="room">Room</Label>
            <Input id="room" name="room" placeholder="B-204" />
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
              {pending ? "Creating…" : "Create class"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
