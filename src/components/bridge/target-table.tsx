"use client";

import { useState } from "react";

import {
  columnAverage,
  overallAverage,
  requiredEotAverage,
  TARGET_COLUMNS,
  TARGET_ROWS,
  type Cell,
  type SubjectTargets,
} from "@/lib/bridge/target-table";

const numRe = /^\d{0,4}(\.\d{0,2})?$/;

export function TargetTable({
  subject,
  data,
  onChange,
  rows = TARGET_ROWS,
  mode = "average",
}: {
  subject: string;
  data: SubjectTargets;
  onChange: (next: SubjectTargets) => void;
  rows?: number;
  mode?: "average" | "target";
}) {
  const setCell = (
    col: string,
    row: number,
    field: keyof Cell,
    value: string,
  ) => {
    if (value !== "" && !numRe.test(value)) return;
    const cells = Array.from(
      { length: rows },
      (_, i) => data[col]?.[i] ?? { got: "", total: "" },
    );
    const cell = cells[row];
    if (!cell) return;
    cells[row] = { ...cell, [field]: value };
    onChange({ ...data, [col]: cells });
  };

  const overall = overallAverage(data);
  const eotFilled = columnAverage(data["EOT"], 100) !== null;
  const [targetInput, setTargetInput] = useState("");
  const targetValue = targetInput.trim() === "" ? null : Number(targetInput);
  const requiredEot =
    !eotFilled && targetValue !== null
      ? requiredEotAverage(data, targetValue)
      : null;

  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-3">
      {mode === "target" && (
        <p className="mb-3 px-1 text-sm font-semibold text-foreground">
          Enter your targeted marks below
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              {TARGET_COLUMNS.map((c) => (
                <th
                  key={c.key}
                  className="px-2 pb-2 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  {c.key}{" "}
                  <span className="font-normal normal-case text-foreground">
                    /{c.max}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, row) => (
              <tr key={row}>
                {TARGET_COLUMNS.map((c) => {
                  const cell = data[c.key]?.[row] ?? { got: "", total: "" };
                  return (
                    <td key={c.key} className="px-1 py-1">
                      <div className="flex items-center gap-1">
                        <input
                          inputMode="decimal"
                          value={cell.got}
                          placeholder="_"
                          onChange={(e) =>
                            setCell(c.key, row, "got", e.target.value)
                          }
                          aria-label={`${subject} ${c.key} entry ${row + 1} marks obtained`}
                          className="w-12 rounded border border-input bg-card px-1.5 py-1 text-right text-foreground outline-none focus:border-ring"
                        />
                        <span className="text-muted-foreground">/</span>
                        <input
                          inputMode="decimal"
                          value={cell.total}
                          placeholder="_"
                          onChange={(e) =>
                            setCell(c.key, row, "total", e.target.value)
                          }
                          aria-label={`${subject} ${c.key} entry ${row + 1} total marks`}
                          className="w-12 rounded border border-input bg-card px-1.5 py-1 text-right text-foreground outline-none focus:border-ring"
                        />
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border">
              {TARGET_COLUMNS.map((c) => {
                const avg = columnAverage(data[c.key], c.max);
                return (
                  <td key={c.key} className="px-2 pt-2 text-xs">
                    <span className="text-muted-foreground">Avg </span>
                    <span className="font-semibold text-foreground">
                      {avg === null ? "—" : avg.toFixed(1)}
                    </span>
                    <span className="text-muted-foreground">/{c.max}</span>
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-card px-4 py-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {mode === "target"
              ? "Targeted term average"
              : "Term average from this table"}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {overall
              ? `${overall.columns} of ${TARGET_COLUMNS.length} columns recorded · earned column averages / 400 × 100.`
              : "Fill a column and its average joins this total automatically."}
          </p>
        </div>
        <p className="text-2xl font-semibold text-foreground">
          {overall ? overall.value.toFixed(1) : "—"}
          <span className="ml-1 text-sm font-normal text-muted-foreground">
            /100
          </span>
        </p>
      </div>

      {mode === "average" && !eotFilled && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-warning/50 bg-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              No EOT yet? Set a target
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {requiredEot === null
                ? "Enter the term average you wish to get, and the EOT marks you need appear here."
                : requiredEot > 100
                  ? "That target is out of reach with these marks — even a perfect EOT would not be enough."
                  : requiredEot <= 0
                    ? "You have already secured this target — any EOT mark keeps you above it."
                    : `You need an EOT average of ${requiredEot.toFixed(1)}/100 to reach ${targetValue}.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              inputMode="decimal"
              value={targetInput}
              placeholder="e.g. 80"
              onChange={(e) => {
                const v = e.target.value;
                if (v !== "" && !numRe.test(v)) return;
                if (v !== "" && Number(v) > 100) return;
                setTargetInput(v);
              }}
              aria-label={`${subject} target term average out of 100`}
              className="w-20 rounded border border-input bg-card px-2 py-1.5 text-right text-foreground outline-none focus:border-ring"
            />
            <span className="text-sm text-muted-foreground">/100 target</span>
            {requiredEot !== null &&
              requiredEot >= 0 &&
              requiredEot <= 100 && (
                <p className="text-xl font-semibold text-warning">
                  EOT {requiredEot.toFixed(1)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    /100
                  </span>
                </p>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
