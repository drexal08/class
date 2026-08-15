"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createAssignmentAction } from "@/lib/actions/classwork-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type Topic = { id: string; name: string };

let nextCriterionKey = 0;

export function CreateAssignmentDialog({
  courseId,
  topics,
}: {
  courseId: string;
  topics: Topic[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("ASSIGNMENT");
  const [criteria, setCriteria] = useState<number[]>([]);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAssignmentAction,
    EMPTY_ACTION_STATE,
  );

  // Material is reference reading — it is never turned in, so points and rubrics
  // do not apply to it.
  const isGraded = type !== "MATERIAL";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Create
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create classwork</DialogTitle>
          <DialogDescription>
            Assignments, quizzes and questions are graded. Material is reference
            only.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="courseId" value={courseId} />

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
                autoFocus
                placeholder="Chapter 4 problem set"
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
              rows={4}
              maxLength={10000}
              placeholder="What should students do? Include any context they need."
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
                  defaultValue={100}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due</Label>
              <Input id="dueDate" name="dueDate" type="datetime-local" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="topicId">Topic</Label>
              {/* Radix rejects an empty string as a value, so "none" is the
                  sentinel the action maps back to "no topic". */}
              <Select name="topicId" defaultValue="none">
                <SelectTrigger id="topicId">
                  <SelectValue placeholder="No topic" />
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
            <>
              <Separator />

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rubric</Label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Optional. Criteria appear beside the work while you grade.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setCriteria((rows) => [...rows, (nextCriterionKey += 1)])
                    }
                  >
                    <Plus />
                    Add criterion
                  </Button>
                </div>

                {criteria.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {criteria.map((key) => (
                      <li key={key} className="flex items-center gap-2">
                        <Input
                          name="rubricTitle"
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
                          defaultValue={10}
                          className="w-24"
                          aria-label="Criterion points"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label="Remove criterion"
                          onClick={() =>
                            setCriteria((rows) => rows.filter((r) => r !== key))
                          }
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button
              type="submit"
              name="published"
              value="false"
              variant="outline"
              disabled={pending}
            >
              Save as draft
            </Button>
            <Button type="submit" name="published" value="true" disabled={pending}>
              {pending ? "Posting…" : "Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
