"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { setBridgeLevelAction } from "@/lib/actions/bridge-actions";
import { LEVEL_KEYS, LEVELS, type Level } from "@/lib/bridge/combinations";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * First-visit level choice.
 *
 * A student keeps the same level for their whole time on CLA Bridge, so this
 * is a deliberate one-time decision: pick a card, then continue. Admins can
 * still switch levels from the estimator itself.
 */
export function BridgeLevelPicker({ isAdmin }: { isAdmin: boolean }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    setBridgeLevelAction,
    EMPTY_ACTION_STATE,
  );
  const [selected, setSelected] = useState<Level | null>(null);

  return (
    <div className="mx-auto max-w-3xl">
      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        CLA Bridge
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        Which level are you in?
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        Your level sets the subjects and combination codes the estimator uses.
        {isAdmin
          ? " As an administrator you can switch levels later."
          : " Choose carefully — your level cannot be changed after this."}
      </p>

      <form action={formAction} className="mt-8">
        <FormError message={state.error} />
        <input type="hidden" name="level" value={selected ?? ""} />

        <fieldset className="mt-4 grid gap-3 sm:grid-cols-3">
          <legend className="sr-only">School level</legend>
          {LEVEL_KEYS.map((key) => {
            const active = selected === key;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => setSelected(key)}
                className={cn(
                  "rounded-lg border bg-card p-5 text-left transition-colors",
                  active
                    ? "border-primary ring-1 ring-primary"
                    : "border-border hover:border-primary/50",
                )}
              >
                <span
                  className={cn(
                    "text-2xl font-semibold",
                    active ? "text-primary" : "text-foreground",
                  )}
                >
                  {key.toUpperCase()}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {LEVELS[key].label}
                </span>
                <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">
                  {LEVELS[key].combos.length} combinations ·{" "}
                  {LEVELS[key].combos[0]?.cores.length ?? 0} core subjects
                </span>
              </button>
            );
          })}
        </fieldset>

        <Button
          type="submit"
          disabled={!selected || pending}
          className="mt-6"
        >
          {pending ? "Setting your level…" : "Continue to CLA Bridge"}
          <ArrowRight />
        </Button>
      </form>
    </div>
  );
}
