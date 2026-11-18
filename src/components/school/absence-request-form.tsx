"use client";

import { useActionState, useTransition } from "react";
import { Send, X } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  cancelAbsenceRequestAction,
  createAbsenceRequestAction,
} from "@/lib/actions/attendance-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";

type RequestRow = {
  id: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  status: "PENDING" | "APPROVED" | "DECLINED";
  decisionNote: string | null;
  course: { id: string; name: string };
};

const STATUS_TONES = {
  PENDING: "bg-warning-muted text-warning border-warning/20",
  APPROVED: "bg-success-muted text-success border-success/20",
  DECLINED: "bg-danger-muted text-danger border-danger/20",
} as const;

function formatDay(value: Date): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function AbsenceRequestForm({
  courses,
  requests,
}: {
  courses: Array<{ id: string; name: string }>;
  requests: RequestRow[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createAbsenceRequestAction,
    EMPTY_ACTION_STATE,
  );

  if (courses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Join a class before requesting an absence.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <div className="space-y-2">
          <Label htmlFor="absence-course">Class</Label>
          <Select name="courseId" defaultValue={courses[0]?.id}>
            <SelectTrigger id="absence-course">
              <SelectValue placeholder="Choose a class" />
            </SelectTrigger>
            <SelectContent>
              {courses.map((course) => (
                <SelectItem key={course.id} value={course.id}>
                  {course.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="absence-from">First day</Label>
            <Input id="absence-from" name="fromDate" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="absence-to">Last day</Label>
            <Input id="absence-to" name="toDate" type="date" required />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="absence-reason">Reason</Label>
          <Textarea
            id="absence-reason"
            name="reason"
            rows={3}
            required
            minLength={5}
            maxLength={1000}
            placeholder="Explain the absence so your teacher can decide."
          />
        </div>

        <Button type="submit" disabled={pending}>
          <Send strokeWidth={1.75} />
          {pending ? "Sending…" : "Send request"}
        </Button>
      </form>

      {requests.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold tracking-tight">
            Your recent requests
          </h3>
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {requests.map((request) => (
              <li key={request.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    {request.course.name} · {formatDay(request.fromDate)} –{" "}
                    {formatDay(request.toDate)}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                    {request.reason}
                  </p>
                  {request.decisionNote && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Teacher: {request.decisionNote}
                    </p>
                  )}
                </div>

                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
                    STATUS_TONES[request.status],
                  )}
                >
                  {request.status.toLowerCase()}
                </span>

                {request.status === "PENDING" && (
                  <CancelButton requestId={request.id} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CancelButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Cancel request"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelAbsenceRequestAction(requestId);
          if (result.error) toast.error(result.error);
          else toast.success("Request cancelled");
        })
      }
    >
      <X strokeWidth={1.75} />
    </Button>
  );
}
