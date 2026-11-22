"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";

interface ImportPreview {
  token: string;
  commitKey: string;
  expiresAt: string;
  preview: {
    sheets: Array<{
      label: string;
      rows: number;
      grade: string;
      combination: string;
    }>;
    warnings: Array<{ kind: string; sheetName: string; message: string }>;
    totalRows: number;
  };
}

interface CohortImportProps {
  cohortId: string;
}

export function CohortImport({ cohortId }: CohortImportProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [overridePassword, setOverridePassword] = useState("");
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pending, setPending] = useState(false);
  const [step, setStep] = useState<"upload" | "preview">("upload");
  const [error, setError] = useState("");

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Please select a file");
      return;
    }
    setError("");
    setPending(true);

    const formData = new FormData();
    formData.append("file", file);
    if (overridePassword) formData.append("overridePassword", overridePassword);

    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.errors?.[0]?.message ?? data.error ?? "Import preview failed");
        setPending(false);
        return;
      }

      setPreview(data);
      setStep("preview");
      setPending(false);
    } catch {
      setError("Upload failed. Please try again.");
      setPending(false);
    }
  }

  async function handleCommit() {
    if (!preview) return;
    setPending(true);
    setError("");

    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: preview.token,
          commitKey: preview.commitKey,
          schoolId: preview.preview.sheets[0]?.label ? "" : "", // will need schoolId from context
          overridePassword: overridePassword || undefined,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Commit failed");
        setPending(false);
        return;
      }

      toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
      router.refresh();
      setStep("upload");
      setPreview(null);
      setFile(null);
      setOverridePassword("");
    } catch {
      setError("Commit failed. Please try again.");
      setPending(false);
    }
  }

  if (step === "upload") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import student roster
          </CardTitle>
          <CardDescription>
            Upload an .xlsx workbook (one sheet per cohort). Maximum 8 MB, 2,000 rows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <FormError message={error} />
            <div className="space-y-2">
              <Label htmlFor="import-file">Workbook (.xlsx)</Label>
              <Input
                id="import-file"
                type="file"
                accept=".xlsx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                disabled={pending}
              />
              <p className="text-xs text-muted-foreground">
                Legacy .xls files are not supported. Save as .xlsx first.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="override-password">Override cohort password (optional)</Label>
              <Input
                id="override-password"
                type="password"
                value={overridePassword}
                onChange={(e) => setOverridePassword(e.target.value)}
                placeholder="Leave blank for Cla@<year>"
                disabled={pending}
              />
            </div>
            <Button type="submit" disabled={pending || !file}>
              {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Preview import"}
            </Button>
          </form>
        </CardContent>
      </Card>
    );
  }

  // step === "preview" - preview is guaranteed non-null here
  const p = preview!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import preview</CardTitle>
        <CardDescription>
          Review the changes before committing. This preview expires in 30 minutes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-secondary p-4 space-y-2">
          <p><strong>Total rows:</strong> {p.preview.totalRows}</p>
          <p><strong>Sheets:</strong> {p.preview.sheets.length}</p>
          {p.preview.sheets.map((sheet) => (
            <div key={sheet.label} className="ml-4 text-sm">
              <p>
                <strong>{sheet.label}</strong> ({sheet.grade} · {sheet.combination}) — {sheet.rows} students
              </p>
            </div>
          ))}
        </div>
        {p.preview.warnings.length > 0 && (
          <div className="rounded-lg border border-warning/20 bg-warning-muted p-4 space-y-1">
            <AlertCircle className="h-4 w-4 text-warning" />
            <p className="text-sm font-medium text-warning">Warnings</p>
            {p.preview.warnings.map((w, i) => (
              <p key={i} className="text-sm ml-4">{w.sheetName}: {w.message}</p>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setStep("upload"); setPreview(null); }} disabled={pending}>
            Back
          </Button>
          <Button onClick={handleCommit} disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Commit import"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}