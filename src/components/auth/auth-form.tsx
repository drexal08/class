"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertCircle, GraduationCap, Loader2, Mail, Lock, School, User } from "lucide-react";

import {
  devSignInAction,
  googleAction,
  goTo,
  signInAction,
  signUpAction,
  type AuthOutcome,
} from "@/components/auth/auth-client";
import { StudentCodeLogin } from "@/components/auth/student-code-login";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";
type Role = "TEACHER" | "STUDENT";

/** The server's "this is a new account, what is it?" answer. */
type RoleQuestion = Extract<AuthOutcome, { status: "needs-role" }>;

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
  const [role, setRole] = useState<Role | "">("");
  const [roleQuestion, setRoleQuestion] = useState<RoleQuestion | null>(null);
  const isSignUp = mode === "signup";

  // Firebase is the real path; dev sign-in exists so the app is usable locally
  // before anyone has set up a Firebase project.
  const useDevMode = !firebaseEnabled && devEnabled;

  function handle(outcome: AuthOutcome) {
    if (outcome.status === "signed-in") {
      goTo(next);
      return;
    }
    if (outcome.status === "needs-role") {
      setRoleQuestion(outcome);
      setError(null);
      return;
    }
    setError(outcome.error);
  }

  function run(action: () => Promise<AuthOutcome>) {
    setError(null);
    startTransition(async () => {
      handle(await action());
    });
  }

  function answerRole(choice: Role) {
    if (!roleQuestion) return;
    setError(null);
    startTransition(async () => {
      try {
        handle(await roleQuestion.retry(choice));
      } catch {
        setError("Could not finish signing in. Please try again.");
      }
    });
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    run(() => {
      if (useDevMode) return devSignInAction(formData);
      return isSignUp ? signUpAction(formData) : signInAction(formData);
    });
  }

  const unavailable = !firebaseEnabled && !devEnabled;

  // A new account has to be told what it is before it is created. The sign-up
  // form asks directly; a Google sign-in is asked by the server, which is the
  // only place that knows whether the account is new.
  if (roleQuestion) {
    return (
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">
          One quick question
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {roleQuestion.displayName
            ? `Welcome, ${roleQuestion.displayName}. `
            : "Welcome. "}
          Are you joining a class, or do you want to teach one?
        </p>

        <div className="mt-6 space-y-3">
          <RoleChoice
            icon={GraduationCap}
            title="I'm a student"
            description="Join with a class code your teacher gives you."
            disabled={pending}
            onClick={() => answerRole("STUDENT")}
          />
          <RoleChoice
            icon={School}
            title="I'm a teacher"
            description="Create classes, invite students and set classwork."
            disabled={pending}
            onClick={() => answerRole("TEACHER")}
          />
        </div>

        {error && (
          <Alert role="alert">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{error}</span>
          </Alert>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mt-4"
          disabled={pending}
          onClick={() => setRoleQuestion(null)}
        >
          Back
        </Button>
      </div>
    );
  }

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

      <Tabs defaultValue="google" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="google" disabled={!firebaseEnabled}>
            <GoogleMark className="mr-2 h-4 w-4" /> Google
          </TabsTrigger>
          <TabsTrigger value="student-code">Student Code</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
        </TabsList>

        <TabsContent value="google" className="space-y-4">
          {firebaseEnabled ? (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => run(() => googleAction(role || undefined))}
            >
              <GoogleMark />
              Continue with Google
            </Button>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              Google sign-in is not configured. Add Firebase keys to enable it.
            </p>
          )}
        </TabsContent>

        <TabsContent value="student-code" className="space-y-4">
          <StudentCodeLogin next={params.get("next") ?? undefined} />
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
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

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="role">I am a</Label>
                <Select
                  name="role"
                  value={role}
                  onValueChange={(value) => setRole(value as Role)}
                >
                  <SelectTrigger id="role" disabled={unavailable || pending}>
                    <SelectValue placeholder="Choose one" />
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

            <Button
              type="submit"
              className="w-full"
              disabled={
                unavailable || pending || (isSignUp && role !== "TEACHER" && role !== "STUDENT")
              }
            >
              {pending && <Loader2 className="animate-spin" />}
              {pending
                ? "Please wait…"
                : isSignUp
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

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

/** One of the two answers to "what is this account?". */
function RoleChoice({
  icon: Icon,
  title,
  description,
  disabled,
  onClick,
}: {
  icon: typeof GraduationCap;
  title: string;
  description: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto w-full justify-start gap-3 py-3 text-left"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
          {description}
        </span>
      </span>
    </Button>
  );
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

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-4", className)} aria-hidden>
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
        d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05L2.18 9.7a11 11 0 0 0 0 9.9l3.66-2.84Z"
      />
      <path
        fill="#EA4334"
        d="M12 4.75c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 1.46 14.97.5 12 .5c-4.38 0-8.18 2.31-9.82 5.65l3.66 2.84c.87-2.6 3.3-4.64 6.16-4.64Z"
      />
    </svg>
  );
}
