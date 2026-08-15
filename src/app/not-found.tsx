import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-secondary">
          <FileQuestion
            className="size-5 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden
          />
        </span>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          This page doesn&rsquo;t exist, or you don&rsquo;t have access to it.
        </p>

        <Button asChild className="mt-6">
          <Link href="/dashboard">Back to your classes</Link>
        </Button>
      </div>
    </div>
  );
}
