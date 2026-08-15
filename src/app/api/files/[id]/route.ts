import { NextResponse } from "next/server";

import { AuthError, requireCourseAccess } from "@/lib/auth/guards";
import { isStorageConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { resolveFileUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Authorised file access.
 *
 * Attachments are never linked to directly. A presigned GET expires, so storing
 * one in the database would break every link within the hour; and a public
 * bucket URL never expires, which would leave student submissions readable by
 * anyone who obtained the link. This route checks permission on each request
 * and redirects to a freshly signed URL, so the bucket can stay private.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isStorageConfigured()) {
    return NextResponse.json(
      { error: "File storage is not configured." },
      { status: 501 },
    );
  }

  const { id } = await params;

  const attachment = await prisma.attachment.findUnique({
    where: { id },
    select: {
      key: true,
      name: true,
      announcement: { select: { courseId: true } },
      assignment: { select: { courseId: true } },
      submission: {
        select: { studentId: true, assignment: { select: { courseId: true } } },
      },
    },
  });

  if (!attachment) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const courseId =
    attachment.announcement?.courseId ??
    attachment.assignment?.courseId ??
    attachment.submission?.assignment.courseId;

  // An attachment with no parent is orphaned; nobody should reach it.
  if (!courseId) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  try {
    const context = await requireCourseAccess(courseId);

    // Submitted work is private between its author and the course teachers —
    // classmates are members of the course but must not read each other's work.
    if (attachment.submission) {
      const isOwner = attachment.submission.studentId === context.user.id;
      if (!isOwner && !context.isTeacher) {
        return NextResponse.json({ error: "Not allowed" }, { status: 403 });
      }
    }
  } catch (error) {
    const status = error instanceof AuthError ? 403 : 500;
    return NextResponse.json({ error: "Not allowed" }, { status });
  }

  const url = await resolveFileUrl(attachment.key);
  if (!url) {
    return NextResponse.json(
      { error: "Could not produce a download link" },
      { status: 500 },
    );
  }

  // Short-lived redirect; the signed URL must never be cached by a proxy.
  return NextResponse.redirect(url, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
