import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

/**
 * The LMS Core mark.
 *
 * A single geometric "L" drawn as one continuous stroke: a vertical stem that
 * curves into a foot, with the foot fading back a step so the mark reads as a
 * path rather than a slab. It is drawn with `currentColor` on a `bg-primary`
 * tile, so it follows the theme and never introduces a colour of its own.
 *
 * The same geometry is reproduced in `src/app/icon.svg` (the favicon) and
 * `src/app/opengraph-image.tsx` (the social card). Keep the three in step.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        className,
      )}
    >
      <svg viewBox="0 0 32 32" aria-hidden focusable="false" className="size-full">
        <path
          d="M11 8.5V19a4.5 4.5 0 0 0 4.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M15.5 23.5H21"
          fill="none"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.72"
        />
      </svg>
    </span>
  );
}

/**
 * The mark and the wordmark together.
 *
 * `nameClassName` lets a caller hide the wordmark on narrow screens, which is
 * what the app header does. The name comes from `siteConfig` so the wordmark
 * can never drift from the one used in metadata and page titles.
 */
export function LogoLockup({
  className,
  nameClassName,
}: {
  className?: string;
  nameClassName?: string;
}) {
  const [lead, ...rest] = siteConfig.name.split(" ");
  const tail = rest.join(" ");

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className="size-8" />
      <span
        className={cn(
          "text-base font-semibold tracking-tight text-foreground",
          nameClassName,
        )}
      >
        {lead}
        {tail ? (
          <span className="font-normal text-muted-foreground"> {tail}</span>
        ) : null}
      </span>
    </span>
  );
}
