"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword === currentPassword) {
      setError("New password must be different from current password");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPassword, newPassword }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error ?? "Failed to change password");
          return;
        }

        setSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Password changed. You will need to sign in again on other devices.");
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5" /> Change password
        </CardTitle>
        <CardDescription>
          Changing your password will sign you out on all other devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive-muted px-3 py-2.5 text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}
          {success && (
            <div className="rounded-md border border-success/20 bg-success-muted px-3 py-2.5 text-sm text-success flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span>Password changed successfully. You may need to sign in again.</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              name="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              disabled={pending || success}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              name="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              disabled={pending || success}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">At least 8 characters</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <Input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={pending || success}
              required
            />
          </div>
          <Button type="submit" disabled={pending || success}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Change password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}