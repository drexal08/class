"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  devSignInAction,
  googleAction,
  signInAction,
  signUpAction,
} from "@/components/auth/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

export function AuthForm({
  mode,
  firebaseEnabled,
  devEnabled,
}: {
  mode: Mode;
  firebaseEnabled: boolean;
  devEnabled: boolean;
}) {
  const params = useSearchParams();
  const next = params.get("next");

  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const isSignUp = mode === "signup";

  // Firebase is the real path; dev sign-in exists so the app is usable locally
  // before anyone has set up a Firebase project.
  const useDevMode = !firebaseEnabled && devEnabled;

  function run(action: () => Promise<{ error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) setError(result.error);
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    run(() => {
      if (useDevMode) return devSignInAction(next, formData);
      return isSignUp ? signUpAction(next, formData) : signInAction(next, formData);
    });
  }

  const unavailable = !firebaseEnabled && !devEnabled;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {isSignUp ? "Create your account" : "Welcome back"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isSignUp
            ? "Join a class as a student, or start teaching your own."
            : "Sign in to reach your classes."}
        </p>
      </div>

      {unavailable && (
        <Alert>
          Authentication is not configured on this deployment. Add your Firebase
          keys, or set <code className="font-mono">AUTH_DEV_MODE=true</code> for
          local development — see SETUP.md.
        </Alert>
      )}

      {useDevMode && (
        <div className="mb-5 rounded-md border border-warning/20 bg-warning-muted px-3 py-2.5 text-xs text-warning">
          <span className="font-medium">Development sign-in.</span> Firebase is
          not configured, so any email signs you in without a password. Never
          enable this in production.
        </div>
      )}

      {error && (
        <Alert role="alert">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </Alert>
      )}

      {firebaseEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={pending}
            onClick={() =>
              run(() =>
                googleAction(next, isSignUp ? getRole() : undefined),
              )
            }
          >
            <GoogleMark />
            Continue with Google
          </Button>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        {isSignUp && (
          <div className="space-y-2">
            <Label htmlFor="displayName">Full name</Label>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              placeholder="Ada Lovelace"
              required={!useDevMode}
              disabled={unavailable || pending}
            />
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@school.edu"
            required
            disabled={unavailable || pending}
          />
        </div>

        {!useDevMode && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {isSignUp && (
                <span className="text-xs text-muted-foreground">
                  8+ characters
                </span>
              )}
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              disabled={unavailable || pending}
            />
          </div>
        )}

        {(isSignUp || useDevMode) && (
          <div className="space-y-2">
            <Label htmlFor="role">I am a</Label>
            <Select name="role" defaultValue="STUDENT">
              <SelectTrigger id="role" disabled={unavailable || pending}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Student</SelectItem>
                <SelectItem value="TEACHER">Teacher</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Teachers can create classes. Students join with a class code.
            </p>
          </div>
        )}

        <Button type="submit" className="w-full" disabled={unavailable || pending}>
          {pending && <Loader2 className="animate-spin" />}
          {pending
            ? "Please wait…"
            : isSignUp
              ? "Create account"
              : "Sign in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? "Already have an account?" : "New here?"}{" "}
        <Link
          href={isSignUp ? "/login" : "/register"}
          className="font-medium text-foreground underline-offset-4 hover:underline"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </div>
  );
}

function getRole(): "TEACHER" | "STUDENT" {
  const select = document.querySelector<HTMLSelectElement>('[name="role"]');
  return select?.value === "TEACHER" ? "TEACHER" : "STUDENT";
}

function Alert({
  children,
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "mb-5 flex items-start gap-2 rounded-md border border-danger/20 bg-danger-muted px-3 py-2.5 text-sm text-danger",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5a11 11 0 0 0-9.82 6.05l3.66 2.84c.87-2.6 3.3-4.64 6.16-4.64Z"
      />
    </svg>
  );
}
