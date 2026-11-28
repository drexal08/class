import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/shell/app-header";
import { Sidebar } from "@/components/ui/sidebar";
import { SidebarProvider } from "@/components/ui/sidebar-context";
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
  const layoutStarted = Date.now();
  const user = await getCurrentUser({ allowUnclaimed: true });
  const userMs = Date.now() - layoutStarted;
  if (!user) redirect("/login");
  const claimStarted = Date.now();
  const pending = await getPendingClaim(user.id);
  const claimMs = Date.now() - claimStarted;
  // #region agent log
  fetch('http://127.0.0.1:7828/ingest/62b85801-70a6-40cf-a67e-0e8937ac4fa4',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'214fb7'},body:JSON.stringify({sessionId:'214fb7',hypothesisId:'A',location:'src/app/(app)/layout.tsx',message:'private layout gate',data:{userMs,claimMs,pending:Boolean(pending),totalMs:Date.now()-layoutStarted},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (pending) redirect("/welcome");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SidebarProvider>
        <AppHeader user={user} />
        <div className="flex-1 flex">
          <Sidebar user={user} isAdmin={user.isAdmin} role={user.role} />
          <main id="main" className="flex-1 pb-16 lg:pl-0">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}