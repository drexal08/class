"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

export function JoinSchoolPrompt() {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-muted-foreground">You are not a member of any school.</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask your school admin for the school code, then request to join.
      </p>
      <div className="mt-4">
        <Link href="/join-school" className="text-accent hover:underline">
          Join a school &rarr;
        </Link>
      </div>
    </div>
  );
}