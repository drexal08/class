"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveCategorySetAction,
  seedDefaultCategoriesAction,
} from "@/lib/actions/gradebook-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";

type Row = {
  key: string;
  id?: string;
  name: string;
  weight: string;
};

function newRow(weight = "0"): Row {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36),
    name: "",
    weight,
  };
}

export function CategoryWeightsForm({
  courseId,
  termId,
  categories,
}: {
  courseId: string;
  termId: string;
  categories: Array<{ id: string; name: string; weight: number }>;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveCategorySetAction,
    EMPTY_ACTION_STATE,
  );
  const [busy, startTransition] = useTransition();

  const [rows, setRows] = useState<Row[]>(() =>
    categories.length > 0
      ? categories.map((category) => ({
          key: category.id,
          id: category.id,
          name: category.name,
          weight: String(category.weight),
        }))
      : [newRow("40"), newRow("40"), newRow("20")],
  );

  const total = useMemo(
    () => rows.reduce((sum, row) => sum + (Number(row.weight) || 0), 0),
    [rows],
  );

  const namesValid = rows.every((row) => row.name.trim().length > 0);
  const weightsValid = rows.every((row) => {
    const value = Number(row.weight);
    return Number.isInteger(value) && value >= 0 && value <= 100;
  });
  const valid = rows.length > 0 && total === 100 && namesValid && weightsValid;

  function update(key: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  function remove(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function add() {
    setRows((current) => [...current, newRow()]);
  }

  function seedDefaults() {
    startTransition(async () => {
      const result = await seedDefaultCategoriesAction(courseId, termId);
      if (result.error) toast.error(result.error);
      else toast.success("Default categories added");
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="courseId" value={courseId} />
      <input type="hidden" name="termId" value={termId} />

      <FormError message={state.error} />

      <div className="space-y-2">
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="grid grid-cols-[1fr_7rem_auto] items-center gap-2"
          >
            <input type="hidden" name="categoryId" value={row.id ?? ""} />
            <Input
              aria-label={`Category ${index + 1} name`}
              name="categoryName"
              placeholder="Coursework"
              value={row.name}
              maxLength={60}
              onChange={(event) => update(row.key, { name: event.target.value })}
            />
            <div className="relative">
              <Input
                aria-label={`Category ${index + 1} weight`}
                name="categoryWeight"
                type="number"
                min={0}
                max={100}
                step={1}
                inputMode="numeric"
                value={row.weight}
                onChange={(event) =>
                  update(row.key, { weight: event.target.value })
                }
                className="pr-8 text-right tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                %
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${row.name || "category"}`}
              disabled={rows.length === 1}
              onClick={() => remove(row.key)}
            >
              <Trash2 strokeWidth={1.75} />
            </Button>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={add}>
            <Plus strokeWidth={1.75} />
            Add category
          </Button>

          {categories.length === 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={seedDefaults}
            >
              <Sparkles strokeWidth={1.75} />
              Use defaults
            </Button>
          )}
        </div>

        <p
          className={cn(
            "text-sm tabular-nums",
            total === 100 ? "text-success" : "text-warning",
          )}
        >
          Total {total}%{" "}
          {total !== 100 && (
            <span className="text-muted-foreground">
              — weights must add up to 100%
            </span>
          )}
        </p>
      </div>

      <Button type="submit" disabled={pending || !valid}>
        {pending ? "Saving…" : "Save weights"}
      </Button>

      {rows.length > 0 && categories.some((category) => category.weight > 0) && (
        <p className="text-xs text-muted-foreground">
          Removing a category is refused while it still has grade items.
        </p>
      )}
    </form>
  );
}
