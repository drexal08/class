"use client";

import { useActionState, useTransition } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { activateTermAction, createTermAction } from "@/lib/actions/term-actions";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";

type Term = {
  id: string;
  academicYear: string;
  name: string;
  startsOn: Date;
  endsOn: Date;
  isActive: boolean;
};

function dateValue(value: Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

export function TermManager({ terms }: { terms: Term[] }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createTermAction,
    EMPTY_ACTION_STATE,
  );

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {terms.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No terms yet. Grades and attendance need one.
          </li>
        ) : (
          terms.map((term) => (
            <li
              key={term.id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {term.name}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {term.academicYear}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {dateValue(term.startsOn)} – {dateValue(term.endsOn)}
                </p>
              </div>

              {term.isActive ? (
                <span className="flex items-center gap-1 text-xs font-medium text-success">
                  <CheckCircle2 className="size-3.5" strokeWidth={2} aria-hidden />
                  Active
                </span>
              ) : (
                <ActivateButton termId={term.id} name={term.name} />
              )}
            </li>
          ))
        )}
      </ul>

      <form action={formAction} className="space-y-4">
        <FormError message={state.error} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="term-year">Academic year</Label>
            <Input
              id="term-year"
              name="academicYear"
              placeholder="2026-2027"
              pattern="\d{4}-\d{4}"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-name">Term name</Label>
            <Input
              id="term-name"
              name="name"
              placeholder="Term 1"
              maxLength={60}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-start">Starts</Label>
            <Input id="term-start" name="startsOn" type="date" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="term-end">Ends</Label>
            <Input id="term-end" name="endsOn" type="date" required />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isActive"
            value="true"
            className="size-4 rounded border-input"
          />
          Make this the active term
        </label>

        <Button type="submit" disabled={pending}>
          <Plus strokeWidth={1.75} />
          {pending ? "Creating…" : "Create term"}
        </Button>
      </form>
    </div>
  );
}

function ActivateButton({ termId, name }: { termId: string; name: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await activateTermAction(termId);
          if (result.error) toast.error(result.error);
          else toast.success(`${name} is now the active term`);
        })
      }
    >
      Activate
    </Button>
  );
}
