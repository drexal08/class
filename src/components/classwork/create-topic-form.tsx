"use client";

import { useActionState, useRef, useState } from "react";
import { FolderPlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createTopicAction } from "@/lib/actions/classwork-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function CreateTopicForm({ courseId }: { courseId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Closing inside the action avoids a setState-in-effect cascade.
  const [, formAction, pending] = useActionState<ActionState, FormData>(
    async (previous, formData) => {
      const result = await createTopicAction(previous, formData);
      if (result.success) {
        formRef.current?.reset();
        setOpen(false);
      }
      return result;
    },
    EMPTY_ACTION_STATE,
  );

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        <FolderPlus />
        Topic
      </Button>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="courseId" value={courseId} />
      <Input
        name="name"
        required
        autoFocus
        maxLength={120}
        placeholder="Topic name"
        aria-label="Topic name"
        className="w-48"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "Add"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
    </form>
  );
}
