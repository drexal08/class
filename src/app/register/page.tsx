import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthLayout } from "@/app/login/page";
import { Skeleton } from "@/components/ui/skeleton";
import { isDevAuthEnabledClient, isFirebaseClientConfigured } from "@/lib/env";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Create an account",
  description: `Create a ${siteConfig.name} account to join a class as a student or start teaching your own.`,
  alternates: { canonical: "/register" },
};

export default function RegisterPage() {
  return (
    <AuthLayout>
      <Suspense fallback={<Skeleton className="h-80 w-full max-w-sm" />}>
        <AuthForm
          mode="signup"
          firebaseEnabled={isFirebaseClientConfigured()}
          devEnabled={isDevAuthEnabledClient()}
        />
      </Suspense>
    </AuthLayout>
  );
}
