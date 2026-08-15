import { NextResponse } from "next/server";

import { requireCourseAccess } from "@/lib/auth/guards";
import { getCurrentUser } from "@/lib/auth/session";
import { isRealtimeConfigured } from "@/lib/env";
import { authorizeChannel } from "@/lib/realtime/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authorises Pusher private channels.
 *
 * Without this, `private-course-*` subscriptions would be open to anyone who
 * knows a course id. Course channels require enrollment; user channels require
 * that you are that user.
 */
export async function POST(request: Request) {
  if (!isRealtimeConfigured()) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 501 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const form = await request.formData();
  const socketId = String(form.get("socket_id") ?? "");
  const channel = String(form.get("channel_name") ?? "");

  if (!socketId || !channel) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const courseMatch = /^private-course-(.+)$/.exec(channel);
  const userMatch = /^private-user-(.+)$/.exec(channel);

  try {
    if (courseMatch) {
      await requireCourseAccess(courseMatch[1]);
    } else if (userMatch) {
      if (userMatch[1] !== user.id) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    } else {
      return NextResponse.json({ error: "Unknown channel" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const auth = authorizeChannel(socketId, channel);
  if (!auth) {
    return NextResponse.json({ error: "Realtime is not configured" }, { status: 501 });
  }

  return NextResponse.json(auth);
}
