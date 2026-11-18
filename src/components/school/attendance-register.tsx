"use client";

import { useActionState, useState } from "react";
import { Check, CheckCheck } from "lucide-react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  decideAbsenceRequestAction,
  saveAttendanceAction,
} from "@/lib/actions/attendance-actions";
import {
  ATTENDANCE_LABELS,
  ATTENDANCE_STATUSES,
  type AttendanceStatusValue,
} from "@/lib/school/attendance";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { cn, displayNameOf } from "@/lib/utils";

type Row = {
  student: { id: string; displayName: string | null; email: string };
  status: AttendanceStatusValue | null;
  note: string | null;
  minutesLate: number | null;
};

type PendingRequest = {
  id: string;
  fromDate: Date;
  toDate: Date;
  reason: string;
  student: { id: string; displayName: string | null; email: string };
};

const STATUS_TONES: Record<AttendanceStatusValue, string> = {
  PRESENT: "bg-success-muted text-success border-success/30",
  LATE: "bg-warning-muted text-warning border-warning/30",
  ABSENT: "bg-danger-muted text-danger border-danger/30",
  EXCUSED: "bg-info-muted text-info border-info/30",
  LEFT_EARLY: "bg-warning-muted text-warning border-warning/30",
};

function formatDay(date: Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function AttendanceRegister({
  courseId,
  dateKey,
  period,
  topic,
  rows,
  requests,
}: {
  courseId: string;
  dateKey: string;
  period: string;
  topic: string | null;
  rows: Row[];
  requests: PendingRequest[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveAttendanceAction,
    EMPTY_ACTION_STATE,
  );

  const [statuses, setStatuses] = useState<Record<string, AttendanceStatusValue>>(
    () =>
      Object.fromEntries(
        rows.map((row) => [row.student.id, row.status ?? "PRESENT"]),
      ),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.student.id, row.note ?? ""])),
  );
  const [minutesLate, setMinutesLate] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.student.id,
        row.minutesLate === null ? "" : String(row.minutesLate),
      ]),
    ),
  );

  function markAllPresent() {
    setStatuses(
      Object.fromEntries(rows.map((row) => [row.student.id, "PRESENT"])),
    );
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-6">
        <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          Nobody is enrolled in this class yet.
        </p>
        <AbsenceInbox courseId={courseId} requests={requests} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="courseId" value={courseId} />
        <input type="hidden" name="date" value={dateKey} />
        <input type="hidden" name="period" value={period} />

        <FormError message={state.error} />

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="register-topic">Lesson topic (optional)</Label>
            <Input
              id="register-topic"
              name="topic"
              maxLength={200}
              defaultValue={topic ?? ""}
              placeholder="Fractions — word problems"
            />
          </div>
          <Button type="button" variant="outline" onClick={markAllPresent}>
            <CheckCheck strokeWidth={1.75} />
            Mark all present
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Attendance for {dateKey}. Each student has one status.
            </caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Student
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Status
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Note
                </th>
                <th scope="col" className="px-4 py-3 text-left font-medium">
                  Late (min)
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const status = statuses[row.student.id] ?? "PRESENT";
                return (
                  <tr
                    key={row.student.id}
                    className="border-b border-border last:border-0"
                  >
                    <th
                      scope="row"
                      className="max-w-56 truncate px-4 py-2.5 text-left font-normal"
                    >
                      {displayNameOf(row.student)}
                      <input
                        type="hidden"
                        name="studentId"
                        value={row.student.id}
                      />
                      <input type="hidden" name="status" value={status} />
                    </th>

                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap gap-1.5">
                        {ATTENDANCE_STATUSES.map((option) => (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={status === option}
                            onClick={() =>
                              setStatuses((current) => ({
                                ...current,
                                [row.student.id]: option,
                              }))
                            }
                            className={cn(
                              "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                              status === option
                                ? STATUS_TONES[option]
                                : "border-border bg-card text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {ATTENDANCE_LABELS[option]}
                          </button>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-2.5">
                      <Textarea
                        name="note"
                        aria-label={`Note for ${displayNameOf(row.student)}`}
                        rows={1}
                        maxLength={200}
                        value={notes[row.student.id] ?? ""}
                        onChange={(event) =>
                          setNotes((current) => ({
                            ...current,
                            [row.student.id]: event.target.value,
                          }))
                        }
                        className="min-h-8 py-1.5"
                      />
                    </td>

                    <td className="px-4 py-2.5">
                      {/* Hidden so every row submits a value, keeping the
                          parallel arrays aligned; the visible input is only
                          enabled for a late arrival. */}
                      <input
                        type="hidden"
                        name="minutesLate"
                        value={
                          status === "LATE"
                            ? (minutesLate[row.student.id] ?? "")
                            : ""
                        }
                      />
                      <Input
                        aria-label={`Minutes late for ${displayNameOf(row.student)}`}
                        type="number"
                        min={0}
                        max={600}
                        inputMode="numeric"
                        disabled={status !== "LATE"}
                        value={status === "LATE" ? (minutesLate[row.student.id] ?? "") : ""}
                        onChange={(event) =>
                          setMinutesLate((current) => ({
                            ...current,
                            [row.student.id]: event.target.value,
                          }))
                        }
                        className="w-24 tabular-nums"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <Button type="submit" disabled={pending}>
          <Check strokeWidth={1.75} />
          {pending ? "Saving…" : "Save register"}
        </Button>
      </form>

      <AbsenceInbox courseId={courseId} requests={requests} />
    </div>
  );
}

function AbsenceInbox({
  courseId,
  requests,
}: {
  courseId: string;
  requests: PendingRequest[];
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    decideAbsenceRequestAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <section>
      <h3 className="text-base font-semibold tracking-tight">
        Absence requests
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Approving a request resolves it. It does not change the register — mark
        the day excused there yourself.
      </p>

      <FormError message={state.error} />

      {requests.length === 0 ? (
        <p className="mt-3 rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          No pending requests.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card">
          {requests.map((request) => (
            <li key={request.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium">{displayNameOf(request.student)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDay(request.fromDate)} – {formatDay(request.toDate)}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {request.reason}
                  </p>
                </div>

                <form action={formAction} className="flex items-center gap-2">
                  <input type="hidden" name="courseId" value={courseId} />
                  <input type="hidden" name="requestId" value={request.id} />
                  <input
                    type="hidden"
                    name="note"
                    value=""
                  />
                  <Button
                    type="submit"
                    name="status"
                    value="APPROVED"
                    size="sm"
                    disabled={pending}
                  >
                    Approve
                  </Button>
                  <Button
                    type="submit"
                    name="status"
                    value="DECLINED"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                  >
                    Decline
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
