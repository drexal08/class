import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Everything in this group is private: student work, grades and class
 * discussion. Search engines are told explicitly to stay out.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // `proxy.ts` only checks that a cookie exists. This is where the session is
  // actually verified, so a forged cookie stops here.
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader user={user} />
      <main id="main" className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
