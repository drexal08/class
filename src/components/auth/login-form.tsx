"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

import { FormError } from "@/components/shared/form-error";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, Lock, AlertCircle } from "lucide-react";
import { signInAction, googleAction, devSignInAction, type AuthOutcome } from "@/components/auth/auth-client";
import { EMPTY_ACTION_STATE, type ActionState } from "@/lib/types";
import { GoogleMark } from "@/components/auth/auth-form";
import { siteConfig } from "@/lib/site";
import { cn } from "@/lib/utils";

interface LoginFormProps {
  next?: string;
}

export function LoginForm({ next = "/dashboard" }: LoginFormProps) {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? next;

  const [formState, setFormState] = React.useState<AuthOutcome>({ status: "error", error: "" });
  const [isDevMode, setIsDevMode] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState<"code" | "email" | "google">("code");

  const handleCodeSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const code = formData.get("code") as string;
    const password = formData.get("password") as string;

    if (!code || !password) {
      setFormState({ status: "error", error: "Enter your code and password" });
      return;
    }

    // Use the student code login endpoint
    const response = await fetch("/api/auth/student-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      setFormState({ status: "error", error: data.error ?? "Code or password is incorrect." });
      return;
    }

    if (data.needsRole) {
      setFormState({ status: "error", error: "Account needs role configuration. Contact your teacher." });
      return;
    }

    toast.success("Signed in");
    window.location.href = nextPath;
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!email || !password) {
      setFormState({ status: "error", error: "Enter your email and password" });
      return;
    }

    const result = await signInAction(formData);
    setFormState(result);

    if (result.status === "signed-in") {
      toast.success("Signed in");
      window.location.href = nextPath;
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await googleAction();
    if (result.status === "signed-in") {
      toast.success("Signed in");
      window.location.href = nextPath;
    } else if (result.status === "error") {
      setFormState({ status: "error", error: result.error });
    }
  };

  const handleDevSignIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const result = await devSignInAction(formData);
    setFormState(result);
    if (result.status === "signed-in") {
      toast.success("Signed in (dev mode)");
      window.location.href = nextPath;
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to {siteConfig.name} to continue
          </p>
        </div>

        {/* Sign-in tabs */}
        <div className="mb-6 border-b border-border">
          <nav className="flex gap-4" role="tablist">
            <button
              role="tab"
              aria-selected={activeTab === "code"}
              onClick={() => setActiveTab("code")}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === "code"
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Student Code
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "email"}
              onClick={() => setActiveTab("email")}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === "email"
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Email
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "google"}
              onClick={() => setActiveTab("google")}
              className={cn(
                "pb-3 text-sm font-medium transition-colors border-b-2 -mb-px",
                activeTab === "google"
                  ? "border-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Google
            </button>
          </nav>
        </div>

        {/* Student Code Sign-in */}
        {activeTab === "code" && (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student-code">Student code</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="student-code"
                  name="code"
                  type="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="ABC12345"
                  className="pl-10 font-mono uppercase"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cohort-password">Cohort password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="cohort-password"
                  name="password"
                  type="password"
                  placeholder="Cla@2026"
                  autoComplete="current-password"
                  required
                />
              </div>
            </div>
            {formState.status === "error" && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formState.error}</span>
              </div>
            )}
            <Button type="submit" className="w-full" disabled={formState.status === "signed-in"}>
              Sign in
            </Button>
          </form>
        )}

        {/* Email Sign-in */}
        {activeTab === "email" && (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                />
              </div>
            </div>
            {formState.status === "error" && (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{formState.error}</span>
              </div>
            )}
            {formState.status === "needs-role" && (
              <div className="rounded-lg bg-secondary p-3 text-sm text-muted-foreground">
                This email is new. Choose your role to continue.
              </div>
            )}
            <Button type="submit" className="w-full" disabled={formState.status === "signed-in"}>
              Sign in
            </Button>
          </form>
        )}

        {/* Google Sign-in */}
        {activeTab === "google" && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleGoogleSignIn}
              disabled={formState.status === "signed-in"}
            >
              <GoogleMark />
              Continue with Google
            </Button>
          </div>
        )}

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Development only
            </span>
          </div>
        </div>

        {/* Dev mode sign-in */}
        <form onSubmit={handleDevSignIn} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dev-email">Email</Label>
            <Input id="dev-email" name="email" type="email" placeholder="teacher@school.edu" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-name">Display name</Label>
            <Input id="dev-name" name="displayName" placeholder="John Doe" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dev-role">Role</Label>
            <select
              id="dev-role"
              name="role"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-foreground file:border-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            >
              <option value="">Choose role</option>
              <option value="TEACHER">Teacher</option>
              <option value="STUDENT">Student</option>
            </select>
          </div>
          <Button type="submit" className="w-full" variant="secondary">
            Sign in (Dev Mode)
          </Button>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <a href="/register" className="text-primary hover:underline font-medium">
            Create an account
          </a>
        </p>
      </div>
    </div>
  );
}

export default LoginForm;