"use client";

import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Unhandled error", error);
  }, [error]);

  // The most common cause in a fresh deployment is a missing DATABASE_URL, so
  // that case gets a specific, actionable message instead of a generic one.
  const isConfigError = /DATABASE_URL|not configured/i.test(error.message);

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-danger-muted">
          <TriangleAlert className="size-5 text-danger" strokeWidth={1.75} aria-hidden />
        </span>

        <h1 className="mt-5 text-2xl font-semibold tracking-tight">
          Something went wrong
        </h1>

        <p className="mt-2 text-sm text-muted-foreground">
          {isConfigError
            ? "This deployment isn't connected to a database yet. Add DATABASE_URL to your environment — see SETUP.md."
            : "An unexpected error occurred. Trying again often resolves it."}
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
