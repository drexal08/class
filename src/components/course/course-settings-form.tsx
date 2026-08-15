"use client";

import { useActionState, useTransition } from "react";
import { Archive, ArchiveRestore, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { ClassCode } from "@/components/course/class-code";
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
  regenerateJoinCodeAction,
  setArchivedAction,
  updateCourseAction,
} from "@/lib/actions/course-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type Course = {
  id: string;
  name: string;
  section: string | null;
  subject: string | null;
  room: string | null;
  description: string | null;
  code: string;
  archived: boolean;
  postPolicy: string;
};

export function CourseSettingsForm({ course }: { course: Course }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateCourseAction,
    EMPTY_ACTION_STATE,
  );
  const [busy, startTransition] = useTransition();

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <h2 className="font-medium">Class details</h2>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="courseId" value={course.id} />

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
              defaultValue={course.name}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="section">Section</Label>
              <Input
                id="section"
                name="section"
                defaultValue={course.section ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                name="subject"
                defaultValue={course.subject ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="room">Room</Label>
              <Input id="room" name="room" defaultValue={course.room ?? ""} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              rows={3}
              maxLength={2000}
              defaultValue={course.description ?? ""}
              placeholder="What is this class about? Shown at the top of the stream."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postPolicy">Who can post on the stream</Label>
            <Select name="postPolicy" defaultValue={course.postPolicy}>
              <SelectTrigger id="postPolicy">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENTS_CAN_POST_AND_COMMENT">
                  Students can post and comment
                </SelectItem>
                <SelectItem value="STUDENTS_CAN_COMMENT_ONLY">
                  Students can comment only
                </SelectItem>
                <SelectItem value="ONLY_TEACHERS">Only teachers</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">Class code</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Students use this to join. Reset it to stop new people joining with the
          old one — anyone already enrolled stays enrolled.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <ClassCode
            code={course.code}
            courseId={course.id}
            size="lg"
            showInviteLink
          />
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() =>
              startTransition(async () => {
                const result = await regenerateJoinCodeAction(course.id);
                if (result.error) toast.error(result.error);
                else toast.success("New class code generated");
              })
            }
          >
            <RefreshCw strokeWidth={1.75} />
            Reset code
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-medium">
          {course.archived ? "Restore class" : "Archive class"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {course.archived
            ? "Restoring makes this class active again for everyone in it."
            : "Archiving makes the class read-only. Nothing is deleted, and you can restore it at any time."}
        </p>

        <Button
          variant={course.archived ? "default" : "outline"}
          className="mt-4"
          disabled={busy}
          onClick={() =>
            startTransition(async () => {
              const result = await setArchivedAction(course.id, !course.archived);
              if (result.error) toast.error(result.error);
              else
                toast.success(
                  course.archived ? "Class restored" : "Class archived",
                );
            })
          }
        >
          {course.archived ? <ArchiveRestore /> : <Archive />}
          {course.archived ? "Restore class" : "Archive class"}
        </Button>
      </Card>
    </div>
  );
}
