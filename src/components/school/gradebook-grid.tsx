"use client";

import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { saveScoreAction } from "@/lib/actions/gradebook-actions";
import {
  computeClassAverages,
  meanOfAverages,
} from "@/lib/school/grading";
import { cn, displayNameOf } from "@/lib/utils";

type Student = {
  id: string;
  displayName: string | null;
  email: string;
};

type Category = { id: string; name: string; weight: number };

type Item = {
  id: string;
  title: string;
  categoryId: string;
  maximum: number;
};

type Score = {
  gradeItemId: string;
  studentId: string;
  score: number | null;
};

function cellKey(itemId: string, studentId: string): string {
  return `${itemId}:${studentId}`;
}

/** "" and "-" both mean "not marked", which is not the same as zero. */
function parseScore(raw: string): number | null | "invalid" {
  const text = raw.trim();
  if (text === "" || text === "-") return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) return "invalid";
  return value;
}

export function GradebookGrid({
  courseId,
  termId,
  students,
  categories,
  items,
  scores,
}: {
  courseId: string;
  termId: string;
  students: Student[];
  categories: Category[];
  items: Item[];
  scores: Score[];
}) {
  const initial = useMemo(() => {
    const map: Record<string, string> = {};
    for (const score of scores) {
      map[cellKey(score.gradeItemId, score.studentId)] =
        score.score === null ? "" : String(score.score);
    }
    return map;
  }, [scores]);

  const [values, setValues] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState<Set<string>>(new Set());
  // Last value the server accepted, so a failure can put the cell back.
  const persisted = useRef<Record<string, string>>({ ...initial });

  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );

  const results = useMemo(() => {
    const entries = items.flatMap((item) =>
      students.map((student) => ({
        studentId: student.id,
        categoryId: item.categoryId,
        maximum: item.maximum,
        score: parseScore(values[cellKey(item.id, student.id)] ?? ""),
      })),
    );

    return computeClassAverages(
      students.map((student) => student.id),
      entries.map((entry) => ({
        ...entry,
        // An unparsed value is mid-typing; treat it as not marked until it is
        // either accepted by the server or reverted.
        score: entry.score === "invalid" ? null : entry.score,
      })),
      categories.map((category) => ({ id: category.id, weight: category.weight })),
    );
  }, [values, items, students, categories]);

  const classAverage = meanOfAverages(
    [...results.values()].map((result) => result.average),
  );

  function updateCell(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function commit(item: Item, student: Student) {
    const key = cellKey(item.id, student.id);
    const raw = values[key] ?? "";
    if (raw === (persisted.current[key] ?? "")) return;

    const parsed = parseScore(raw);
    if (parsed === "invalid") {
      toast.error("Enter a number of 0 or more, or leave it blank");
      updateCell(key, persisted.current[key] ?? "");
      return;
    }

    if (parsed !== null && parsed > item.maximum) {
      toast.error(`${item.title}: the score cannot be more than ${item.maximum}`);
      updateCell(key, persisted.current[key] ?? "");
      return;
    }

    setSaving((current) => new Set(current).add(key));

    const result = await saveScoreAction({
      courseId,
      termId,
      gradeItemId: item.id,
      studentId: student.id,
      score: parsed,
    });

    setSaving((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });

    if (result.error) {
      toast.error(result.error);
      updateCell(key, persisted.current[key] ?? "");
      return;
    }

    persisted.current[key] = raw;
  }

  function handleKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
    item: Item,
    student: Student,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit(item, student);
      focusSibling(event.currentTarget, "next", item.id);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusSibling(event.currentTarget, "next", item.id);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusSibling(event.currentTarget, "previous", item.id);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No grade columns in this term yet. Add one from the gradebook settings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full border border-border bg-secondary px-2.5 py-1"
            >
              {category.name} · {category.weight}%
            </span>
          ))}
        </div>
        <p className="text-sm text-muted-foreground">
          Class average{" "}
          <span className="font-medium text-foreground tabular-nums">
            {classAverage === null ? "—" : `${classAverage}%`}
          </span>
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Weighted gradebook: students by grade item. Blank means not marked.
          </caption>
          <thead>
            <tr className="border-b border-border">
              <th
                scope="col"
                className="sticky left-0 z-10 min-w-44 bg-card px-4 py-3 text-left font-medium"
              >
                Student
              </th>
              {items.map((item) => {
                const category = categoryById.get(item.categoryId);
                return (
                  <th
                    key={item.id}
                    scope="col"
                    className="min-w-24 border-l border-border/60 px-2 py-3 text-left align-bottom font-medium"
                  >
                    <span className="line-clamp-2">{item.title}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      /{item.maximum}
                      {category ? ` · ${category.name}` : ""}
                    </span>
                  </th>
                );
              })}
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Term
              </th>
            </tr>
          </thead>

          <tbody>
            {students.map((student) => {
              const result = results.get(student.id);
              return (
                <tr
                  key={student.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/30"
                >
                  <th
                    scope="row"
                    className="sticky left-0 z-10 max-w-56 truncate bg-card px-4 py-2.5 text-left font-normal"
                  >
                    {displayNameOf(student)}
                  </th>

                  {items.map((item) => {
                    const key = cellKey(item.id, student.id);
                    const isSaving = saving.has(key);
                    return (
                      <td
                        key={item.id}
                        className="border-l border-border/60 px-1 py-1"
                      >
                        <input
                          data-item={item.id}
                          aria-label={`${displayNameOf(student)} — ${item.title}`}
                          inputMode="decimal"
                          value={values[key] ?? ""}
                          placeholder="–"
                          onChange={(event) => updateCell(key, event.target.value)}
                          onBlur={() => void commit(item, student)}
                          onKeyDown={(event) =>
                            handleKeyDown(event, item, student)
                          }
                          className={cn(
                            "h-8 w-full min-w-16 rounded border border-transparent bg-transparent px-2 text-right tabular-nums",
                            "placeholder:text-muted-foreground/60 hover:border-input focus:border-ring focus:bg-background focus:outline-none",
                            isSaving && "animate-pulse",
                          )}
                        />
                      </td>
                    );
                  })}

                  <td className="px-4 py-2.5 text-right font-medium tabular-nums">
                    {result?.average === null || result === undefined
                      ? "—"
                      : `${result.average}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Blank or <kbd className="rounded border border-border px-1">-</kbd>{" "}
        means not marked, which is not counted as zero. Enter moves down the
        column. Changes save when you leave a cell.
      </p>
    </div>
  );
}

/** Focuses the same column in the next or previous row. */
function focusSibling(
  input: HTMLInputElement,
  direction: "next" | "previous",
  itemId: string,
) {
  const row = input.closest("tr");
  const sibling =
    direction === "next" ? row?.nextElementSibling : row?.previousElementSibling;
  const target = sibling?.querySelector<HTMLInputElement>(
    `input[data-item="${CSS.escape(itemId)}"]`,
  );
  if (target) {
    target.focus();
    target.select();
  }
}
