import { NextResponse } from "next/server";

import { requireCourseAccess } from "@/lib/auth/guards";
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_BYTES,
  isStorageConfigured,
} from "@/lib/env";
import { buildObjectKey, createUploadUrl, resolveFileUrl } from "@/lib/storage/r2";
import { presignSchema } from "@/lib/validators";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Issues a short-lived presigned PUT so the browser uploads directly to R2/S3
 * (PRD Module D). The response also carries the eventual public URL, which the
 * client hands back to `saveAttachmentAction` once the upload completes.
 */
export async function POST(request: Request) {
  if (!isStorageConfigured()) {
    // A clear, actionable status rather than a crash — the uploader UI renders
    // a disabled state when storage isn't set up.
    return NextResponse.json(
      { error: "File uploads are not configured on this deployment." },
      { status: 501 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const { courseId, fileName, mimeType, size, scope } = parsed.data;

  try {
    // Only members of the course may upload into it.
    await requireCourseAccess(courseId);
  } catch {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json(
      { error: `Files must be ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB or smaller` },
      { status: 413 },
    );
  }

  if (!ALLOWED_UPLOAD_TYPES.includes(mimeType as (typeof ALLOWED_UPLOAD_TYPES)[number])) {
    return NextResponse.json(
      { error: "That file type is not allowed" },
      { status: 415 },
    );
  }

  const key = buildObjectKey(courseId, scope, fileName);
  const uploadUrl = await createUploadUrl({ key, mimeType, size });
  if (!uploadUrl) {
    return NextResponse.json(
      { error: "Could not prepare the upload" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    key,
    uploadUrl,
    url: await resolveFileUrl(key),
  });
}
