import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while a class tab's data loads. The course header and tab bar live in
 * the layout above this boundary, so they stay on screen and the next tab is
 * still clickable instead of the whole page going blank.
 */
export default function CourseLoading() {
  return (
    <div className="container-page py-6" aria-busy="true" aria-live="polite">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>

        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
