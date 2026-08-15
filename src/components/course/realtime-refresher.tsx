"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";

import { COURSE_EVENTS, useRealtimeChannel } from "@/lib/realtime/client";

/**
 * Renders nothing; refreshes the server components when the class changes.
 *
 * Because every course page is a server component, `router.refresh()` re-runs
 * the authorised render and everything updates — no duplicated client-side
 * fetching, and no chance of a realtime payload leaking content the viewer
 * isn't allowed to see.
 */
export function RealtimeRefresher({ courseId }: { courseId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    // Debounced: a burst of comments should cause one refresh, not ten.
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 400);
  }, [router]);

  useRealtimeChannel(`private-course-${courseId}`, COURSE_EVENTS, refresh);

  return null;
}
