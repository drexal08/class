"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle, Loader2, XCircle, Mail, SkipForward } from "lucide-react";

type PendingClaim = {
  id: string;
  user: { studentCode: string | null; displayName: string | null; nameAsImported: string | null };
  cohort: { id: string; label: string; academicYear: number; combination: { name: string }; school: { id: string; name: string } };
};

type Step = "confirm" | "dispute" | "contact-email";

export function WelcomePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const disputeParam = searchParams.get("dispute");

  const [claim, setClaim] = useState<PendingClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>(disputeParam ? "dispute" : "confirm");
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [disputeNote, setDisputeNote] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [emailError, setEmailError] = useState("");

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
      setStep("contact-email");
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

  async function saveContactEmail() {
    setEmailError("");
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
      setEmailError("Enter a valid email address");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await fetch("/api/auth/contact-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: contactEmail || null }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save email");
      toast.success("Contact email saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save email");
    } finally {
      setSavingEmail(false);
      router.push("/dashboard");
      router.refresh();
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
      <Card className={step === "dispute" ? "border-destructive" : undefined}>
        <CardHeader>
          {step === "dispute" ? (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <CardTitle className="mt-2 text-center">This does not look right</CardTitle>
            </>
          ) : step === "contact-email" ? (
            <>
              <Mail className="mx-auto h-12 w-12 text-success" />
              <CardTitle className="mt-2 text-center">Contact email (optional)</CardTitle>
            </>
          ) : (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-success" />
              <CardTitle className="mt-2 text-center">Confirm your identity</CardTitle>
            </>
          )}
          <CardDescription className="text-center">
            {step === "confirm" && (
              <>You are about to sign in as <strong>{displayName}</strong> in <strong>{claim.cohort.label}</strong>
              ({claim.cohort.combination.name}, {claim.cohort.school.name}, {claim.cohort.academicYear}/{claim.cohort.academicYear + 1}).</>
            )}
            {step === "dispute" && (
              <>Tell us what is wrong. Your teacher and the school admin will be notified.</>
            )}
            {step === "contact-email" && (
              <>Add an optional contact email for account recovery. This is not used for signing in.</>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {(step === "confirm" || step === "dispute") && (
            <div className="rounded-lg bg-secondary p-4 space-y-2 text-sm">
              <p><strong>Student code:</strong> {claim.user.studentCode ?? "—"}</p>
              <p><strong>Name on record:</strong> {displayName}</p>
              <p><strong>Class:</strong> {claim.cohort.label}</p>
              <p><strong>Stream:</strong> {claim.cohort.combination.name}</p>
              <p><strong>School:</strong> {claim.cohort.school.name}</p>
              <p><strong>Academic year:</strong> {claim.cohort.academicYear}/{claim.cohort.academicYear + 1}</p>
            </div>
          )}
          {step === "confirm" && (
            <>
              <p className="text-sm text-muted-foreground text-center">
                If this is not you, do not confirm. Click &ldquo;This is not me&rdquo; to alert your teacher.
              </p>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={confirmClaim} disabled={confirming}>
                  {confirming ? <Loader2 className="h-4 w-4 animate-spin" /> : "This is me"}
                </Button>
                <Button variant="destructive" className="flex-1" onClick={() => setStep("dispute")} disabled={confirming}>
                  <XCircle className="mr-2 h-4 w-4" /> This is not me
                </Button>
              </div>
            </>
          )}
          {step === "dispute" && (
            <div className="space-y-3">
              <textarea
                value={disputeNote}
                onChange={(e) => setDisputeNote(e.target.value)}
                placeholder="e.g., the name does not match me, I never received this code"
                className="w-full min-h-[80px] rounded-md border border-input bg-background p-3 text-sm"
                rows={3}
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("confirm")} disabled={disputing}>
                  Go back
                </Button>
                <Button variant="destructive" onClick={disputeClaim} disabled={disputing || !disputeNote.trim()}>
                  {disputing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit dispute"}
                </Button>
              </div>
            </div>
          )}
          {step === "contact-email" && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="contact-email">Contact email (optional)</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="contact-email"
                    name="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => { setContactEmail(e.target.value); setEmailError(""); }}
                    placeholder="you@example.com"
                    autoComplete="email"
                    className="pl-10"
                    disabled={savingEmail}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "email-error" : undefined}
                  />
                </div>
                {emailError && <p id="email-error" className="text-sm text-destructive" role="alert">{emailError}</p>}
                <p className="text-xs text-muted-foreground">
                  This email is not used for signing in. It helps with account recovery.
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => { router.push("/dashboard"); router.refresh(); }} disabled={savingEmail}>
                  <SkipForward className="mr-2 h-4 w-4" /> Skip
                </Button>
                <Button onClick={saveContactEmail} disabled={savingEmail}>
                  {savingEmail ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save email"}
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