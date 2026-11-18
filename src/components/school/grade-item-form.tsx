"use client";

import { useActionState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createGradeItemAction,
  deleteGradeItemAction,
} from "@/lib/actions/gradebook-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

export function NewGradeItemForm({
  courseId,
  termId,
  categories,
}: {
  courseId: string;
  termId: string;
  categories: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createGradeItemAction,
    EMPTY_ACTION_STATE,
  );

  if (categories.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Save at least one category before adding grade columns.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="termId" value={termId} />

      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="item-title">Title</Label>
          <Input
            id="item-title"
            name="title"
            required
            maxLength={120}
            placeholder="Test 2"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-category">Category</Label>
          <Select name="categoryId" defaultValue={categories[0]?.id}>
            <SelectTrigger id="item-category">
              <SelectValue placeholder="Choose a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-maximum">Marks available</Label>
          <Input
            id="item-maximum"
            name="maximum"
            type="number"
            min={1}
            step="0.5"
            required
            defaultValue={100}
            className="tabular-nums"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="item-date">Assessed on</Label>
          <Input
            id="item-date"
            name="assessedOn"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add grade column"}
      </Button>
    </form>
  );
}

export function DeleteGradeItemButton({
  courseId,
  gradeItemId,
  title,
}: {
  courseId: string;
  gradeItemId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm(`Delete "${title}" and every score entered for it?`)) {
      return;
    }

    startTransition(async () => {
      const result = await deleteGradeItemAction(courseId, gradeItemId);
      if (result.error) toast.error(result.error);
      else toast.success("Grade column deleted");
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`Delete ${title}`}
      disabled={pending}
      onClick={remove}
    >
      <Trash2 strokeWidth={1.75} />
    </Button>
  );
}
