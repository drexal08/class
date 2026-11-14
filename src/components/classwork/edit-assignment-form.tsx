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

type Criterion = {
  id: string;
  title: string;
  description: string | null;
  points: number;
};

type Assignment = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  maxPoints: number;
  dueDate: Date | null;
  published: boolean;
  acceptingSubmissions: boolean;
  allowLateSubmissions: boolean;
  topic: { id: string; name: string } | null;
  rubric: Criterion[];
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
  const [criteria, setCriteria] = useState<Criterion[]>(assignment.rubric);
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

          {isGraded && (
            <div className="space-y-3 rounded-md border border-border p-4">
              <div>
                <p className="text-sm font-medium">Turn-in settings</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Closing turn-ins keeps the assignment visible but stops new
                  submissions.
                </p>
              </div>

              <label className="flex items-start gap-3 text-sm">
                <input type="hidden" name="acceptingSubmissions" value="false" />
                <input
                  type="checkbox"
                  name="acceptingSubmissions"
                  value="true"
                  defaultChecked={assignment.acceptingSubmissions}
                  className="mt-0.5 size-4 rounded border-border accent-primary"
                />
                <span>
                  Accept submissions
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Students can turn work in until you close it.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 text-sm">
                <input type="hidden" name="allowLateSubmissions" value="false" />
                <input
                  type="checkbox"
                  name="allowLateSubmissions"
                  value="true"
                  defaultChecked={assignment.allowLateSubmissions}
                  className="mt-0.5 size-4 rounded border-border accent-primary"
                />
                <span>
                  Accept late work
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Work turned in after the due date is marked as late.
                  </span>
                </span>
              </label>
            </div>
          )}

          {isGraded && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Rubric</Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Changing criteria replaces the rubric and clears marks
                    already recorded against it.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setCriteria((rows) => [
                      ...rows,
                      {
                        id: `new-${rows.length}-${Date.now()}`,
                        title: "",
                        description: null,
                        points: 10,
                      },
                    ])
                  }
                >
                  Add criterion
                </Button>
              </div>

              {criteria.length > 0 && (
                <ul className="space-y-2">
                  {criteria.map((criterion, index) => (
                    <li key={criterion.id} className="flex items-center gap-2">
                      <input
                        type="hidden"
                        name="rubricDescription"
                        value={criterion.description ?? ""}
                      />
                      <Input
                        name="rubricTitle"
                        defaultValue={criterion.title}
                        placeholder="e.g. Uses evidence"
                        maxLength={160}
                        className="flex-1"
                        aria-label="Criterion name"
                      />
                      <Input
                        name="rubricPoints"
                        type="number"
                        min={0}
                        max={1000}
                        defaultValue={criterion.points}
                        className="w-24"
                        aria-label="Criterion points"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Remove criterion"
                        onClick={() =>
                          setCriteria((rows) =>
                            rows.filter((_, rowIndex) => rowIndex !== index),
                          )
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

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
