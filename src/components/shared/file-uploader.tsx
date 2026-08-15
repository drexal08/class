"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveAttachmentAction } from "@/lib/actions/attachment-actions";

type Scope = "announcement" | "assignment" | "submission";

/**
 * Three-step upload (PRD Module D): ask the server to presign, PUT the file
 * straight to R2/S3, then persist only its metadata.
 *
 * When storage isn't configured the control renders disabled with an
 * explanation instead of failing at click time.
 */
export function FileUploader({
  courseId,
  scope,
  targetId,
  enabled,
  label = "Attach file",
}: {
  courseId: string;
  scope: Scope;
  targetId: string;
  enabled: boolean;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  async function upload(file: File) {
    setUploading(true);
    try {
      const presign = await fetch("/api/uploads/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          scope,
        }),
      });

      if (!presign.ok) {
        const data = (await presign.json().catch(() => ({}))) as {
          error?: string;
        };
        toast.error(data.error ?? "Could not start the upload");
        return;
      }

      const { uploadUrl, url, key } = (await presign.json()) as {
        uploadUrl: string;
        url: string;
        key: string;
      };

      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!put.ok) {
        // Almost always the bucket's CORS rules rejecting the browser's PUT.
        toast.error("Upload failed. Check the bucket's CORS configuration.");
        return;
      }

      const result = await saveAttachmentAction(
        courseId,
        { scope, id: targetId },
        {
          name: file.name,
          url,
          key,
          mimeType: file.type || undefined,
          size: file.size,
        },
      );

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`${file.name} attached`);
      router.refresh();
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (!enabled) {
    return (
      <Button variant="outline" size="sm" disabled title="File uploads are not configured on this deployment">
        <Paperclip strokeWidth={1.75} />
        Uploads unavailable
      </Button>
    );
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {uploading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Paperclip strokeWidth={1.75} />
        )}
        {uploading ? "Uploading…" : label}
      </Button>
    </>
  );
}
