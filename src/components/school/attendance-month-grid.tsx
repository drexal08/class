import type { MonthMatrix } from "@/lib/school/attendance";
import {
  ATTENDANCE_LABELS,
  summariseDay,
  type AttendanceCounts,
  type AttendanceStatusValue,
} from "@/lib/school/attendance";
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DOT_TONES: Record<AttendanceStatusValue, string> = {
  PRESENT: "bg-success",
  LATE: "bg-warning",
  ABSENT: "bg-danger",
  EXCUSED: "bg-info",
  LEFT_EARLY: "bg-warning",
};

/**
 * Server-rendered month view. A day with no session has no dot at all, which is
 * deliberately different from a red "absent" dot: unrecorded is not absence.
 */
export function AttendanceMonthGrid({
  matrix,
  counts,
  rate,
}: {
  matrix: MonthMatrix;
  counts: AttendanceCounts;
  rate: number | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-sm">
        <Stat label="Present" value={counts.attended} />
        <Stat label="Absent" value={counts.absent} />
        <Stat label="Excused" value={counts.excused} />
        <Stat
          label="Attendance"
          value={rate === null ? "—" : `${rate}%`}
          strong
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Attendance for {matrix.year}-{String(matrix.month).padStart(2, "0")}.
            Days without a dot were not recorded.
          </caption>
          <thead>
            <tr className="border-b border-border">
              {DAY_LABELS.map((label) => (
                <th
                  key={label}
                  scope="col"
                  className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.weeks.map((week, index) => (
              <tr key={index} className="border-b border-border last:border-0">
                {week.map((cell) => {
                  const dominant = summariseDay(cell.statuses);
                  return (
                    <td
                      key={cell.key}
                      className={cn(
                        "h-16 border-r border-border/60 p-1.5 align-top last:border-r-0",
                        !cell.inMonth && "bg-secondary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "block text-xs tabular-nums",
                          cell.inMonth
                            ? "text-foreground"
                            : "text-muted-foreground/60",
                        )}
                      >
                        {cell.dayOfMonth}
                      </span>

                      {dominant && (
                        <span
                          title={ATTENDANCE_LABELS[dominant]}
                          className={cn(
                            "mt-2 block size-2.5 rounded-full",
                            DOT_TONES[dominant],
                          )}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        {(Object.keys(DOT_TONES) as AttendanceStatusValue[]).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span className={cn("size-2.5 rounded-full", DOT_TONES[status])} />
            {ATTENDANCE_LABELS[status]}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full border border-border" />
          Not recorded
        </li>
      </ul>
    </div>
  );
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number | string;
  strong?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn("tabular-nums", strong ? "font-semibold" : "font-medium")}
      >
        {value}
      </span>
    </span>
  );
}
