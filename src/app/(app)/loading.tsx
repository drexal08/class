import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="container-page py-8">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="mt-2 h-4 w-32" />

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-44 w-full" />
        ))}
      </div>
    </div>
  );
}
