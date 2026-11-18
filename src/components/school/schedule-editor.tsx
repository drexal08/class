"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarPlus, Trash2 } from "lucide-react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveScheduleAction } from "@/lib/actions/schedule-actions";
import {
  findOverlaps,
  formatTimeRange,
  WEEKDAY_LABELS,
} from "@/lib/school/schedule";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type Row = {
  key: string;
  weekday: string;
  startsAt: string;
  endsAt: string;
  room: string;
};

function newRow(): Row {
  return {
    key:
      typeof crypto !== "undefined"
        ? crypto.randomUUID()
        : Math.random().toString(36),
    weekday: "0",
    startsAt: "08:00",
    endsAt: "09:00",
    room: "",
  };
}

export function ScheduleEditor({
  courseId,
  slots,
}: {
  courseId: string;
  slots: Array<{
    weekday: number;
    startsAt: string;
    endsAt: string;
    room: string | null;
  }>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveScheduleAction,
    EMPTY_ACTION_STATE,
  );

  const [rows, setRows] = useState<Row[]>(() =>
    slots.map((slot) => ({
      key:
        typeof crypto !== "undefined"
          ? crypto.randomUUID()
          : Math.random().toString(36),
      weekday: String(slot.weekday),
      startsAt: slot.startsAt,
      endsAt: slot.endsAt,
      room: slot.room ?? "",
    })),
  );

  const overlaps = useMemo(
    () =>
      findOverlaps(
        rows.map((row) => ({
          weekday: Number(row.weekday),
          startsAt: row.startsAt,
          endsAt: row.endsAt,
        })),
      ),
    [rows],
  );

  const hasInvalidTime = rows.some(
    (row) => row.startsAt.length === 0 || row.endsAt.length === 0 || row.endsAt <= row.startsAt,
  );

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />

      <FormError message={state.error} />

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
          No weekly slots yet. Add the days and times this class meets.
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="grid grid-cols-2 gap-2 sm:grid-cols-[9rem_8rem_8rem_1fr_auto]"
            >
              <Select
                name="weekday"
                value={row.weekday}
                onValueChange={(value) => update(row.key, { weekday: value })}
              >
                <SelectTrigger aria-label={`Day for slot ${index + 1}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {WEEKDAY_LABELS.map((label, weekday) => (
                    <SelectItem key={label} value={String(weekday)}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                aria-label={`Start time for slot ${index + 1}`}
                name="startsAt"
                type="time"
                required
                value={row.startsAt}
                onChange={(event) =>
                  update(row.key, { startsAt: event.target.value })
                }
              />

              <Input
                aria-label={`End time for slot ${index + 1}`}
                name="endsAt"
                type="time"
                required
                value={row.endsAt}
                onChange={(event) =>
                  update(row.key, { endsAt: event.target.value })
                }
              />

              <Input
                aria-label={`Room for slot ${index + 1}`}
                name="room"
                placeholder="Room (optional)"
                maxLength={60}
                value={row.room}
                onChange={(event) => update(row.key, { room: event.target.value })}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove slot ${index + 1}`}
                onClick={() =>
                  setRows((current) =>
                    current.filter((entry) => entry.key !== row.key),
                  )
                }
              >
                <Trash2 strokeWidth={1.75} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((current) => [...current, newRow()])}
        >
          <CalendarPlus strokeWidth={1.75} />
          Add slot
        </Button>

        {overlaps.length > 0 && (
          <p className="text-sm text-warning">
            {WEEKDAY_LABELS[overlaps[0][0].weekday]}: two slots overlap (
            {formatTimeRange(overlaps[0][0].startsAt, overlaps[0][0].endsAt)} and{" "}
            {formatTimeRange(overlaps[0][1].startsAt, overlaps[0][1].endsAt)})
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={pending || overlaps.length > 0 || hasInvalidTime}
      >
        {pending ? "Saving…" : "Save timetable"}
      </Button>
    </form>
  );
}
