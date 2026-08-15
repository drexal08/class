import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { Skeleton } from "@/components/ui/skeleton";
import { isDevAuthEnabledClient, isFirebaseClientConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Sign in",
  description: `Sign in to ${siteConfig.name} to reach your classes, assignments and grades.`,
  alternates: { canonical: "/login" },
};

export default function LoginPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<FormSkeleton />}>
        <AuthForm
          mode="signin"
          firebaseEnabled={isFirebaseClientConfigured()}
          devEnabled={isDevAuthEnabledClient()}
        />
      </Suspense>
    </AuthLayout>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card">
        <div className="container-page flex h-16 items-center">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
              L
            </span>
            <span className="text-base font-semibold">{siteConfig.name}</span>
          </Link>
        </div>
      </header>
      <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
        {children}
      </main>
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="w-full max-w-sm space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
