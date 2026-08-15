"use client";

import { useActionState, useState, useTransition } from "react";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteAssignmentAction,
  setAssignmentPublishedAction,
  updateAssignmentAction,
} from "@/lib/actions/classwork-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  maxPoints: number;
  dueDate: Date | null;
  published: boolean;
  topic: { id: string; name: string } | null;
};

export function EditAssignmentForm({
  courseId,
  assignment,
  topics,
}: {
  courseId: string;
  assignment: Assignment;
  topics: { id: string; name: string }[];
}) {
  const [type, setType] = useState(assignment.type);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateAssignmentAction,
    EMPTY_ACTION_STATE,
  );
  const [busy, startTransition] = useTransition();

  const isGraded = type !== "MATERIAL";

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />
          <input type="hidden" name="assignmentId" value={assignment.id} />
          <input
            type="hidden"
            name="published"
            value={String(assignment.published)}
          />

          <FormError message={state.error} />

          <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                name="title"
                required
                maxLength={300}
                defaultValue={assignment.title}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select name="type" value={type} onValueChange={setType}>
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSIGNMENT">Assignment</SelectItem>
                  <SelectItem value="QUIZ">Quiz</SelectItem>
                  <SelectItem value="QUESTION">Question</SelectItem>
                  <SelectItem value="MATERIAL">Material</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Instructions</Label>
            <Textarea
              id="description"
              name="description"
              rows={5}
              maxLength={10000}
              defaultValue={assignment.description ?? ""}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {isGraded && (
              <div className="space-y-2">
                <Label htmlFor="maxPoints">Points</Label>
                <Input
                  id="maxPoints"
                  name="maxPoints"
                  type="number"
                  min={0}
                  max={10000}
                  defaultValue={assignment.maxPoints}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due</Label>
              <Input
                id="dueDate"
                name="dueDate"
                type="datetime-local"
                defaultValue={toLocalInput(assignment.dueDate)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicId">Topic</Label>
              <Select name="topicId" defaultValue={assignment.topic?.id ?? "none"}>
                <SelectTrigger id="topicId">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No topic</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic.id} value={topic.id}>
                      {topic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">
          {assignment.published ? "Visible to students" : "Draft"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignment.published
            ? "Students can see this and turn work in."
            : "Only teachers can see this. Publish it when you are ready."}
        </p>

        <Button
          variant="outline"
          className="mt-4"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const result = await setAssignmentPublishedAction(
                courseId,
                assignment.id,
                !assignment.published,
              );
              if (result.error) toast.error(result.error);
              else
                toast.success(
                  assignment.published ? "Moved to drafts" : "Published",
                );
            })
          }
        >
          {assignment.published ? <EyeOff /> : <Eye />}
          {assignment.published ? "Unpublish" : "Publish"}
        </Button>
      </Card>

      <Card className="border-destructive/30 p-6">
        <h2 className="font-medium text-destructive">Delete this classwork</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This removes the item along with every submission, grade and comment on
          it. It cannot be undone.
        </p>

        <Button
          variant="destructive"
          className="mt-4"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const result = await deleteAssignmentAction(courseId, assignment.id);
              if (result?.error) toast.error(result.error);
            })
          }
        >
          <Trash2 />
          Delete permanently
        </Button>
      </Card>
    </div>
  );
}

/** `datetime-local` needs a local-time string, not an ISO UTC one. */
function toLocalInput(date: Date | null): string {
  if (!date) return "";
  const local = new Date(date);
  local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
  return local.toISOString().slice(0, 16);
}
