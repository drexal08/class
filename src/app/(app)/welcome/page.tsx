"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2, XCircle } from "lucide-react";

type PendingClaim = {
  id: string;
  user: { studentCode: string | null; displayName: string | null; nameAsImported: string | null };
  cohort: { id: string; label: string; academicYear: number; combination: { name: string }; school: { id: string; name: string } };
};

export function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const disputeParam = searchParams.get("dispute");

  const [claim, setClaim] = useState<PendingClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");

  async function loadClaim() {
    try {
      const res = await fetch("/api/auth/pending-claim");
      if (!res.ok) {
        if (res.status === 404) router.push("/dashboard");
        else toast.error("Could not load claim information");
        return;
      }
      const data = await res.json();
      setClaim(data);
    } catch {
      toast.error("Could not load claim information");
    } finally {
      setLoading(false);
    }
  }

  async function confirmClaim() {
    if (!claim) return;
    setConfirming(true);
    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: claim.id, action: "confirm" }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to confirm");
      toast.success("Identity confirmed");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not confirm");
    } finally {
      setConfirming(false);
    }
  }

  async function disputeClaim() {
    if (!claim) return;
    setDisputing(true);
    try {
      const res = await fetch("/api/auth/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId: claim.id, action: "dispute", note: disputeNote }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to file dispute");
      toast.success("Dispute recorded. Your teacher has been notified.");
      router.push("/login");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not file dispute");
    } finally {
      setDisputing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!claim) return null;

  const displayName = claim.user.displayName ?? claim.user.nameAsImported ?? "Unknown";

  return (
    <div className="container-page py-12 max-w-md">
      <Card className={disputeParam ? "border-destructive" : undefined}>
        <CardHeader>
          {disputeParam ? (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-2 text-center">This does not look right</CardTitle>
            </>
          ) : (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <CardTitle className="mt-2 text-center">Confirm your identity</CardTitle>
            </>
          )}
          <CardDescription className="text-center">
            You are about to sign in as <strong>{displayName}</strong> in <strong>{claim.cohort.label}</strong>
            ({claim.cohort.combination.name}, {claim.cohort.school.name}, {claim.cohort.academicYear}/{claim.cohort.academicYear + 1}).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg bg-secondary p-4 space-y-2 text-sm">
            <p><strong>Student code:</strong> {claim.user.studentCode ?? "—"}</p>
            <p><strong>Name on record:</strong> {displayName}</p>
            <p><strong>Class:</strong> {claim.cohort.label}</p>
            <p><strong>Stream:</strong> {claim.cohort.combination.name}</p>
            <p><strong>School:</strong> {claim.cohort.school.name}</p>
            <p><strong>Academic year:</strong> {claim.cohort.academicYear}/{claim.cohort.academicYear + 1}</p>
          </div>
          {!disputeParam && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                If this is not you, do not confirm. Click &ldquo;This is not me&rdquo; to alert your teacher.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={confirmClaim} disabled={confirming}>
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "This is me"}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => router.push("/welcome?dispute=1")} disabled={confirming}>
                  <XCircle className="mr-2 h-4 w-4" /> This is not me
                </Button>
              </div>
            </>
          )}
          {disputeParam && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center">
                Tell us what is wrong. Your teacher and the school admin will be notified.
              </p>
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="e.g., the name does not match me, I never received this code"
                className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push("/welcome")} disabled={disputing}>
                  Go back
                </Button>
                <Button variant="destructive" onClick={disputeClaim} disabled={disputing || !disputeNote.trim()}>
                  {disputing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit dispute"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default WelcomePage;