"use client";

import { useEffect, useRef } from "react";
import PusherClient from "pusher-js";

import { isRealtimeConfiguredClient } from "@/lib/env";

let singleton: PusherClient | null = null;

function getClient(): PusherClient | null {
  if (!isRealtimeConfiguredClient()) return null;
  if (singleton) return singleton;

  singleton = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1",
    // Private channels are authorised server-side against course enrollment.
    channelAuthorization: {
      endpoint: "/api/realtime/auth",
      transport: "ajax",
    },
  });
  return singleton;
}

const POLL_INTERVAL_MS = 20_000;

/**
 * Subscribes to a channel and calls `onEvent` when anything changes.
 *
 * Without Pusher credentials this falls back to polling while the tab is
 * visible, so a deployment with no realtime provider still feels live-ish
 * without burning requests in a background tab.
 */
export function useRealtimeChannel(
  channel: string | null,
  events: readonly string[],
  onEvent: () => void,
): void {
  const handler = useRef(onEvent);

  // Kept in an effect rather than assigned during render: refs must not be
  // written while rendering.
  useEffect(() => {
    handler.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!channel) return;

    const client = getClient();

    if (!client) {
      let timer: ReturnType<typeof setInterval> | null = null;

      const start = () => {
        if (timer === null && document.visibilityState === "visible") {
          timer = setInterval(() => handler.current(), POLL_INTERVAL_MS);
        }
      };
      const stop = () => {
        if (timer !== null) {
          clearInterval(timer);
          timer = null;
        }
      };
      const onVisibility = () =>
        document.visibilityState === "visible" ? start() : stop();

      start();
      document.addEventListener("visibilitychange", onVisibility);
      return () => {
        stop();
        document.removeEventListener("visibilitychange", onVisibility);
      };
    }

    const subscription = client.subscribe(channel);
    const callback = () => handler.current();
    events.forEach((event) => subscription.bind(event, callback));

    return () => {
      events.forEach((event) => subscription.unbind(event, callback));
      client.unsubscribe(channel);
    };
    // `events` is a stable literal at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, events.join(",")]);
}

export const COURSE_EVENTS = [
  "announcement:new",
  "announcement:deleted",
  "comment:new",
  "assignment:new",
  "submission:graded",
] as const;
