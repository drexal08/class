"use client";

import { Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** The usefulness rating the student gives the estimator. */
export function UsefulnessRating({
  rating,
  onChange,
}: {
  rating: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <section aria-label="App usefulness" className="mt-10 border-t border-border pt-6">
      <h2 className="text-sm font-semibold text-foreground">
        How useful has CLA Bridge been for you?
      </h2>
      <fieldset className="mt-3 flex gap-2" aria-label="Usefulness rating">
        {[1, 2, 3, 4, 5].map((value) => (
          <Button
            key={value}
            variant="ghost"
            size="icon"
            aria-label={`Rate ${value} out of 5`}
            aria-pressed={rating === value}
            title={`${value} out of 5`}
            onClick={() => onChange(value)}
            className={cn(
              rating !== null && value <= rating
                ? "text-primary"
                : "text-muted-foreground",
            )}
          >
            <Star
              className={
                rating !== null && value <= rating ? "fill-current" : ""
              }
            />
          </Button>
        ))}
      </fieldset>
      <p className="mt-2 text-xs text-muted-foreground">
        {rating
          ? `Your rating: ${rating}/5. Thank you for your feedback.`
          : "1 = Not useful · 5 = Very useful"}
      </p>
    </section>
  );
}
