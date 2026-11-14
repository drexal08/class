"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { leaveCourseAction } from "@/lib/actions/course-actions";

export function LeaveCourseButton({ courseId }: { courseId: string }) {
  const [leaving, startLeaving] = useTransition();

  return (
    <Button
      variant="outline"
      disabled={leaving}
      onClick={() =>
        startLeaving(async () => {
          const result = await leaveCourseAction(courseId);
          if (result?.error) toast.error(result.error);
        })
      }
    >
      <LogOut strokeWidth={1.75} />
      {leaving ? "Leaving…" : "Leave class"}
    </Button>
  );
}
