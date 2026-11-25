"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileSpreadsheet, Download, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface ImportHistoryItem {
  id: string;
  fileName: string;
  fileHash: string;
  importedById: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
  passwordPolicy: string;
  createdAt: string;
  importer: {
    displayName: string | null;
    email: string;
  };
}

interface ImportHistoryProps {
  cohortId: string;
  schoolId: string;
}

interface ImportListProps {
  imports: ImportHistoryItem[];
  loading: boolean;
  onDownloadCredentials: (importId: string) => void;
  onReImport: (importId: string) => void;
}

function ImportList({ imports, loading, onDownloadCredentials, onReImport }: ImportListProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">No imports yet</p>
    );
  }

  return (
    <div className="space-y-3">
      {imports.map((imp) => (
        <div key={imp.id} className="rounded-lg border border-border p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="font-medium">{imp.fileName}</p>
              <p className="text-sm text-muted-foreground flex flex-wrap gap-4">
                <span>
                  <Badge variant="outline">{imp.rows} rows</Badge>
                </span>
                <span className="text-muted-foreground">
                  {imp.created} created · {imp.updated} updated · {imp.skipped} skipped
                </span>
                <span className="text-muted-foreground">
                  {imp.passwordPolicy} password policy
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Imported by {imp.importer.displayName ?? imp.importer.email} on{" "}
                {format(new Date(imp.createdAt), "yyyy-MM-dd HH:mm:ss")}
              </p>
              {imp.warnings.length > 0 && (
                <p className="text-xs text-warning mt-1">
                  Warnings: {imp.warnings.join("; ")}
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDownloadCredentials(imp.id)}
                disabled={imports.length === 0}
              >
                <Download className="mr-2 h-4 w-4" /> Credentials
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onReImport(imp.id)}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Re-import
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ImportHistory({ cohortId, schoolId }: ImportHistoryProps) {
  const router = useRouter();
  const [imports, setImports] = useState<ImportHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, startTransition] = useTransition();

  async function loadImports() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/cohort/${cohortId}/import-history`);
      if (!res.ok) throw new Error("Failed to load import history");
      const data = await res.json();
      setImports(data);
    } catch (error) {
      toast.error("Failed to load import history");
    } finally {
      setLoading(false);
    }
  }

  async function reImport(importId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/cohort/${cohortId}/re-import`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ importId }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Re-import failed");
        toast.success(`Re-imported: ${data.created} created, ${data.updated} updated`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Re-import failed");
      }
    });
  }

  async function downloadCredentials(importId: string) {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/cohort/${cohortId}/import/${importId}/credentials`);
        if (!res.ok) throw new Error("Failed to download credentials");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `credentials-${importId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Credentials downloaded");
      } catch (error) {
        toast.error("Failed to download credentials");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <span className="h-5 w-5" />
          Import history
        </CardTitle>
        <CardDescription>View and manage past imports for this cohort</CardDescription>
      </CardHeader>
      <CardContent>
        <ImportList
          imports={imports}
          loading={loading}
          onDownloadCredentials={downloadCredentials}
          onReImport={reImport}
        />
      </CardContent>
    </Card>
  );
}