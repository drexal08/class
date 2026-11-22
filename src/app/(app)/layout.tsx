import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { getCurrentUser } from "@/lib/auth/session";
import { getPendingClaim } from "@/lib/auth/claim";

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
  // Every private route lives in this group, so this is the only gate: the
  // session is verified here (a forged cookie stops at `getCurrentUser`) and a
  // signed-out visitor is sent to `/login`. There is no middleware in front of
  // it — Next 16 proxies are Node-only and the Workers adapter cannot build
  // them, so the check has to live in the tree rather than beside it.
  const user = await getCurrentUser({ allowUnclaimed: true });
  if (!user) redirect("/login");
  if (await getPendingClaim(user.id)) redirect("/welcome");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AppHeader user={user} />
      <main id="main" className="flex-1 pb-16">
        {children}
      </main>
    </div>
  );
}
