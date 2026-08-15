import "server-only";

import Pusher from "pusher";

import { isRealtimeConfigured } from "@/lib/env";

/**
 * Real-time is an enhancement, never a source of truth.
 *
 * Every mutation already calls `revalidatePath`, so the app is completely
 * correct without Pusher — updates simply arrive on the next navigation rather
 * than instantly. That is why `publish` swallows its errors and no-ops when
 * unconfigured: a broken realtime provider must never fail a student's
 * submission.
 */
let pusher: Pusher | null = null;

function getPusher(): Pusher | null {
  if (!isRealtimeConfigured()) return null;
  if (pusher) return pusher;

  pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "mt1",
    useTLS: true,
  });
  return pusher;
}

export const courseChannel = (courseId: string) => `private-course-${courseId}`;
export const userChannel = (userId: string) => `private-user-${userId}`;

export type RealtimeEvent =
  | "announcement:new"
  | "announcement:deleted"
  | "comment:new"
  | "assignment:new"
  | "submission:new"
  | "submission:graded";

/**
 * Payloads carry identifiers only, never content. Clients react by refetching
 * through the normal authorised server render, so a leaked subscription cannot
 * leak class material.
 */
export async function publish(
  channel: string,
  event: RealtimeEvent,
  payload: { actorId: string; id?: string } = { actorId: "" },
): Promise<void> {
  const client = getPusher();
  if (!client) return;

  try {
    await client.trigger(channel, event, payload);
  } catch (error) {
    console.error("[realtime] publish failed", event, error);
  }
}

/** Authorises a private channel subscription for an already-verified user. */
export function authorizeChannel(socketId: string, channel: string) {
  const client = getPusher();
  if (!client) return null;
  return client.authorizeChannel(socketId, channel);
}
